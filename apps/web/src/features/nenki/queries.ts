import 'server-only';
import { requireCurrentTenantId } from '@/lib/auth';
import { withTenant } from '@/lib/db';
import {
  findAnniversariesInYear,
  type Anniversary,
} from '@/lib/nenki';

export type AnniversaryMatch = {
  entryId: string;
  /** 対象故人 (Person.id)。発送明細 (A-2) の突合キー targetPersonId に使う。 */
  personId: string;
  householdId: string;
  householdName: string;
  secularName: string;
  kaimyoName: string | null;
  ageAtDeath: number | null;
  /** 命日 (西暦)。月日不明 (YEAR/YEAR_MONTH 精度) の故人は month/day が null。 */
  deathDate: { year: number; month: number | null; day: number | null };
  anniversary: Anniversary;
};

/**
 * 指定年に年忌を迎える故人を抽出する。
 *
 * - 論理削除された過去帳エントリ (`deletedAt`) は除外
 * - 離檀世帯 (`Household.isActive=false`) の故人も除外 (案内状送付用のため)
 * - 並び順は法要予定日 (月→日) の昇順。月日不明は末尾
 */
export async function findAnniversariesForYear(
  year: number,
): Promise<AnniversaryMatch[]> {
  const tenantId = await requireCurrentTenantId();

  const entries = await withTenant(tenantId, (tx) =>
    tx.deathLedgerEntry.findMany({
      where: {
        deletedAt: null,
        person: { household: { isActive: true } },
        // 年忌計算には少なくとも没年が必要。年すら不明な故人 (datePrecision=UNKNOWN)
        // は年忌表・案内の対象にできないため除外する。
        deathYear: { not: null },
      },
      include: {
        person: {
          select: {
            id: true,
            household: {
              select: { id: true, householderName: true },
            },
          },
        },
      },
    }),
  );

  const deceased = entries
    // deathYear: { not: null } で絞っているが、型上は nullable なのでここでも狭める。
    .filter((e): e is typeof e & { deathYear: number } => e.deathYear !== null)
    .map((e) => ({
      entryId: e.id,
      personId: e.person.id,
      householdId: e.person.household.id,
      householdName: e.person.household.householderName,
      secularName: e.secularName,
      kaimyoName: e.kaimyoName,
      ageAtDeath: e.ageAtDeath,
      // 弔い上げ済み (打ち切り回忌超え) の故人を年忌表・案内対象から除外するため渡す
      memorialCutoff: e.memorialCutoffAnniversary,
      // 構造化フィールドを真のソースとする。月日不明 (YEAR/YEAR_MONTH) は null のまま
      // 渡し、nenki 側が予定日の月日を null として扱う。
      deathDate: {
        year: e.deathYear,
        month: e.deathMonth,
        day: e.deathDay,
      },
    }));

  const matched = findAnniversariesInYear(deceased, year);

  // 予定日の月日で昇順ソート (不明は末尾へ)
  return sortAnniversariesBySchedule(matched);
}

/** 年忌表のソート軸 (N-2 帳票)。schedule=予定日順 (既定)、kaimyo=戒名順。 */
export type NenkiSortKey = 'schedule' | 'kaimyo';

/** 予定日 (月→日) 昇順。月日不明は末尾へ。新規配列を返す (入力を破壊しない)。 */
export function sortAnniversariesBySchedule(
  matches: readonly AnniversaryMatch[],
): AnniversaryMatch[] {
  return [...matches].sort((a, b) => {
    const ma = a.anniversary.month ?? 99;
    const mb = b.anniversary.month ?? 99;
    if (ma !== mb) return ma - mb;
    const da = a.anniversary.day ?? 99;
    const db = b.anniversary.day ?? 99;
    return da - db;
  });
}

/**
 * 戒名順 (N-2 郵送外注・印刷手渡し用)。日本語ロケールの読み順で並べる。
 * 戒名 (kaimyoName) 未登録は末尾へ。戒名が同一なら俗名で安定させる。
 */
export function sortAnniversariesByKaimyo(
  matches: readonly AnniversaryMatch[],
): AnniversaryMatch[] {
  const collator = new Intl.Collator('ja');
  return [...matches].sort((a, b) => {
    const ka = a.kaimyoName;
    const kb = b.kaimyoName;
    if (ka === null && kb === null) {
      return collator.compare(a.secularName, b.secularName);
    }
    if (ka === null) return 1;
    if (kb === null) return -1;
    const byKaimyo = collator.compare(ka, kb);
    if (byKaimyo !== 0) return byKaimyo;
    return collator.compare(a.secularName, b.secularName);
  });
}

/** ソートキーに応じて年忌一覧を並べ替える。 */
export function sortAnniversaries(
  matches: readonly AnniversaryMatch[],
  sortKey: NenkiSortKey,
): AnniversaryMatch[] {
  return sortKey === 'kaimyo'
    ? sortAnniversariesByKaimyo(matches)
    : sortAnniversariesBySchedule(matches);
}
