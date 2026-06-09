import 'server-only';
import { Prisma } from '@prisma/client';
import { requireCurrentTenantId } from '@/lib/auth';
import { withTenant } from '@/lib/db';
import {
  looksLikeMemo,
  looksLikeName,
  looksLikePhone,
  normalizeKana,
  normalizePhone,
} from './normalize';
import {
  SEARCH_LIMIT_PER_KIND,
  type DeathLedgerSearchResult,
  type GravePlotSearchResult,
  type HouseholdSearchResult,
  type NoteSearchResult,
  type SearchResults,
} from './types';

const EMPTY_RESULTS: SearchResults = {
  households: [],
  deathLedgerEntries: [],
  gravePlots: [],
  noteHits: [],
};

/**
 * 世帯を検索する。
 * - nameKana: 正規化 (ひらがな寄せ) した検索語の部分一致。前方一致を優先して並べる。
 * - phone / mobile: ハイフン等を除いた数字列での部分一致。
 * - memo / address: 検索語の原文 (trim のみ) での部分一致。漢字・カナ・英数混在の
 *   自由記述 (特徴メモ・住所断片) を引くため、かな正規化は行わず原文で照合する。
 *
 * phone/mobile は列側にもハイフンが含まれうるため、`regexp_replace` で数字のみに
 * 正規化してから比較する (Prisma の where では列の正規化ができないため raw SQL)。
 * memo/address は NULL 許容だが ILIKE は NULL に対し UNKNOWN を返すのみで OR 評価上無害
 * (phone と異なり COALESCE は不要)。
 * RLS により withTenant スコープ内でしか他テナント行は見えない。
 */
async function searchHouseholds(
  tx: Prisma.TransactionClient,
  query: string,
): Promise<HouseholdSearchResult[]> {
  const trimmed = query.trim();
  const kana = normalizeKana(query);
  const phone = normalizePhone(query);
  const wantName = looksLikeName(query) && kana.length > 0;
  const wantPhone = looksLikePhone(query);
  const wantMemo = looksLikeMemo(query);

  if (!wantName && !wantPhone && !wantMemo) return [];

  const conditions: Prisma.Sql[] = [];

  if (wantName) {
    const kanaLike = `%${escapeLike(kana)}%`;
    conditions.push(
      Prisma.sql`"nameKana" ILIKE ${kanaLike} ESCAPE '\\'`,
    );
  }
  if (wantPhone) {
    const phoneLike = `%${phone}%`;
    conditions.push(
      Prisma.sql`regexp_replace(COALESCE("phone", ''), '\\D', '', 'g') LIKE ${phoneLike}`,
    );
    conditions.push(
      Prisma.sql`regexp_replace(COALESCE("mobile", ''), '\\D', '', 'g') LIKE ${phoneLike}`,
    );
  }

  // memo/address 一致式。WHERE と SELECT(memoMatch) の両方で再利用するため
  // 関数スコープで組み立てる (wantMemo が false のときは未使用)。
  const memoLike = `%${escapeLike(trimmed)}%`;
  const memoMatchSql = Prisma.sql`(
    "memo" ILIKE ${memoLike} ESCAPE '\\'
    OR "address" ILIKE ${memoLike} ESCAPE '\\'
  )`;
  if (wantMemo) {
    conditions.push(memoMatchSql);
  }

  // 前方一致を上位に。かな検索時のみ意味があるため、それ以外は 1 (同順) とする。
  // memo 一致は前方一致扱いにせず prefixRank=1 グループに残し、名前前方一致の上位表示を壊さない。
  const prefixRank = wantName
    ? Prisma.sql`CASE WHEN "nameKana" ILIKE ${`${escapeLike(kana)}%`} ESCAPE '\\' THEN 0 ELSE 1 END`
    : Prisma.sql`1`;

  // memoMatch は本文を返さずブール値のみ算出する (個人情報非露出)。
  const memoMatchSelect = wantMemo
    ? Prisma.sql`CASE WHEN ${memoMatchSql} THEN true ELSE false END`
    : Prisma.sql`false`;

  const rows = await tx.$queryRaw<
    {
      id: string;
      householderName: string;
      nameKana: string;
      phone: string | null;
      mobile: string | null;
      memoMatch: boolean;
    }[]
  >(Prisma.sql`
    SELECT "id", "householderName", "nameKana", "phone", "mobile",
           ${memoMatchSelect} AS "memoMatch"
    FROM "Household"
    WHERE "isActive" = true
      AND (${Prisma.join(conditions, ' OR ')})
    ORDER BY ${prefixRank}, "nameKana" ASC, "householderName" ASC
    LIMIT ${SEARCH_LIMIT_PER_KIND}
  `);

  return rows.map((r) => ({
    kind: 'household',
    id: r.id,
    householderName: r.householderName,
    nameKana: r.nameKana,
    phone: r.phone ?? r.mobile,
    memoMatch: r.memoMatch,
  }));
}

/**
 * 過去帳エントリを検索する (戒名・俗名の部分一致、過去帳横断)。
 * 論理削除済み (deletedAt) は除外する。
 */
async function searchDeathLedgerEntries(
  tx: Prisma.TransactionClient,
  query: string,
): Promise<DeathLedgerSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return [];

  const entries = await tx.deathLedgerEntry.findMany({
    where: {
      deletedAt: null,
      OR: [
        { kaimyoName: { contains: trimmed, mode: 'insensitive' } },
        { secularName: { contains: trimmed, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      secularName: true,
      kaimyoName: true,
      person: { select: { householdId: true } },
    },
    orderBy: [{ secularName: 'asc' }, { dateOfDeath: 'asc' }],
    take: SEARCH_LIMIT_PER_KIND,
  });

  return entries.map((e) => ({
    kind: 'deathLedgerEntry',
    id: e.id,
    householdId: e.person.householdId,
    kaimyoName: e.kaimyoName,
    secularName: e.secularName,
  }));
}

/**
 * 区画を検索する (G-2 逆引き)。墓標名・刻名・区画番号・使用者姓のいずれからでもヒットする。
 *
 * - monumentName / inscription / plotNumber: 検索語の原文 (trim のみ) で部分一致。
 *   墓標名・刻名は漢字混在の自由記述なので、memo 同様かな正規化せず原文 ILIKE で照合する。
 * - 使用者姓: 契約世帯 (Household) の nameKana を正規化して部分一致 (名前らしいときのみ)。
 * - RLS により withTenant スコープ内でしか他テナント行は見えない。
 */
async function searchGravePlots(
  tx: Prisma.TransactionClient,
  query: string,
): Promise<GravePlotSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return [];

  const kana = normalizeKana(query);
  const wantName = looksLikeName(query) && kana.length > 0;

  const textLike = `%${escapeLike(trimmed)}%`;
  const conditions: Prisma.Sql[] = [
    Prisma.sql`g."monumentName" ILIKE ${textLike} ESCAPE '\\'`,
    Prisma.sql`g."inscription" ILIKE ${textLike} ESCAPE '\\'`,
    Prisma.sql`g."plotNumber" ILIKE ${textLike} ESCAPE '\\'`,
  ];
  if (wantName) {
    const kanaLike = `%${escapeLike(kana)}%`;
    conditions.push(Prisma.sql`h."nameKana" ILIKE ${kanaLike} ESCAPE '\\'`);
  }

  const rows = await tx.$queryRaw<
    {
      id: string;
      plotNumber: string;
      monumentName: string | null;
      inscription: string | null;
      householderName: string | null;
    }[]
  >(Prisma.sql`
    SELECT g."id", g."plotNumber", g."monumentName", g."inscription",
           h."householderName"
    FROM "GravePlot" g
    LEFT JOIN "Household" h ON h."id" = g."householdId"
    WHERE (${Prisma.join(conditions, ' OR ')})
    ORDER BY g."plotNumber" ASC
    LIMIT ${SEARCH_LIMIT_PER_KIND}
  `);

  return rows.map((r) => ({
    kind: 'gravePlot',
    id: r.id,
    plotNumber: r.plotNumber,
    monumentName: r.monumentName,
    inscription: r.inscription,
    householderName: r.householderName,
  }));
}

/** スニペットの一致語前後の文脈文字数 (片側)。 */
const SNIPPET_CONTEXT = 24;
/** スニペット全体の最大長 (暴走防止)。 */
const SNIPPET_MAX = 120;

/**
 * 本文から一致語周辺の抜粋 (snippet) をアプリ側で生成する。
 * 一致が見つからなければ先頭から SNIPPET_MAX 文字を返す。
 * 大文字小文字を無視して最初の一致位置を探す (ILIKE と整合)。
 */
function buildSnippet(content: string, query: string): string {
  const normalized = content.replace(/\s+/g, ' ').trim();
  const idx = normalized.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) {
    const head = normalized.slice(0, SNIPPET_MAX);
    return head.length < normalized.length ? `${head}…` : head;
  }
  const start = Math.max(0, idx - SNIPPET_CONTEXT);
  const end = Math.min(
    normalized.length,
    idx + query.length + SNIPPET_CONTEXT,
  );
  let snippet = normalized.slice(start, end);
  if (snippet.length > SNIPPET_MAX) snippet = snippet.slice(0, SNIPPET_MAX);
  return `${start > 0 ? '…' : ''}${snippet}${end < normalized.length ? '…' : ''}`;
}

/**
 * 履歴本文 (InteractionNote.content) と備考メモ (Household.memo) の全文検索 (S-3)。
 *
 * - 日本語の中間一致を pg_trgm + ILIKE で高速化する (GIN(gin_trgm_ops) インデックス前提)。
 * - 論理削除済みの履歴 (deletedAt) は除外する。
 * - 本文全体は返さず、一致箇所周辺の抜粋のみを付与する (露出を最小化)。
 * - 自由記述の暴発防止のため looksLikeMemo (2 文字以上) を発火条件にする。
 * - RLS により withTenant スコープ内でしか他テナント行は見えない。
 */
async function searchNotes(
  tx: Prisma.TransactionClient,
  query: string,
): Promise<NoteSearchResult[]> {
  const trimmed = query.trim();
  if (!looksLikeMemo(trimmed)) return [];

  const like = `%${escapeLike(trimmed)}%`;

  const [noteRows, memoRows] = await Promise.all([
    tx.$queryRaw<
      {
        id: string;
        householdId: string;
        content: string;
        householderName: string;
      }[]
    >(Prisma.sql`
      SELECT n."id", n."householdId", n."content", h."householderName"
      FROM "InteractionNote" n
      JOIN "Household" h ON h."id" = n."householdId"
      WHERE n."deletedAt" IS NULL
        AND n."content" ILIKE ${like} ESCAPE '\\'
      ORDER BY n."occurredAt" DESC
      LIMIT ${SEARCH_LIMIT_PER_KIND}
    `),
    tx.$queryRaw<
      { id: string; memo: string; householderName: string }[]
    >(Prisma.sql`
      SELECT h."id", h."memo", h."householderName"
      FROM "Household" h
      WHERE h."isActive" = true
        AND h."memo" ILIKE ${like} ESCAPE '\\'
      ORDER BY h."nameKana" ASC
      LIMIT ${SEARCH_LIMIT_PER_KIND}
    `),
  ]);

  const interactionHits: NoteSearchResult[] = noteRows.map((r) => ({
    kind: 'noteHit',
    source: 'interaction',
    id: r.id,
    householdId: r.householdId,
    householderName: r.householderName,
    snippet: buildSnippet(r.content, trimmed),
  }));
  const memoHits: NoteSearchResult[] = memoRows.map((r) => ({
    kind: 'noteHit',
    source: 'memo',
    id: r.id,
    householdId: r.id,
    householderName: r.householderName,
    snippet: buildSnippet(r.memo, trimmed),
  }));

  return [...interactionHits, ...memoHits].slice(0, SEARCH_LIMIT_PER_KIND);
}

/**
 * 横断あいまい検索 (E01)。世帯・過去帳・区画・履歴/メモを同時に引く。
 *
 * - 名前 (かな)・電話・戒名・俗名・墓標名・刻名・区画番号・履歴本文・備考メモをまたいで検索する。
 * - 全 DB アクセスは withTenant 経由 (tenantId 条件なしクエリ禁止)。
 * - 空クエリは即座に空結果 (無駄なクエリを発行しない)。
 */
export async function search(rawQuery: string): Promise<SearchResults> {
  const query = rawQuery.trim();
  if (query.length === 0) return EMPTY_RESULTS;

  const tenantId = await requireCurrentTenantId();

  return withTenant(tenantId, async (tx) => {
    const [households, deathLedgerEntries, gravePlots, noteHits] =
      await Promise.all([
        searchHouseholds(tx, query),
        searchDeathLedgerEntries(tx, query),
        searchGravePlots(tx, query),
        searchNotes(tx, query),
      ]);
    return { households, deathLedgerEntries, gravePlots, noteHits };
  });
}

/**
 * LIKE/ILIKE のメタ文字 (% _ \) をエスケープする。
 * ESCAPE '\\' を併用して使う前提。
 */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}
