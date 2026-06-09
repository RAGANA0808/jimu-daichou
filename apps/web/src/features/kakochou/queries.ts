import 'server-only';
import { Prisma } from '@prisma/client';
import type { DeathLedgerEntry, Person } from '@prisma/client';
import { requireCurrentTenantId } from '@/lib/auth';
import { assertValidUuid, withTenant } from '@/lib/db';
import { deathDateSortKey } from '@/lib/kakochou';
import { normalizeKana } from '@/lib/search';

export type DeathLedgerEntryWithPerson = DeathLedgerEntry & {
  person: Pick<
    Person,
    'id' | 'householdId' | 'name' | 'nameKana' | 'familyRelation'
  >;
};

/** 過去帳横断一覧の 1 行。世帯名も添えて遷移・表示に使う。 */
export type DeathLedgerListItem = DeathLedgerEntry & {
  person: Pick<Person, 'id' | 'householdId' | 'name' | 'nameKana' | 'familyRelation'> & {
    household: { id: string; householderName: string };
  };
};

export type DeathLedgerSort = 'date' | 'kana';

const CROSS_LIST_INCLUDE = {
  person: {
    select: {
      id: true,
      householdId: true,
      name: true,
      nameKana: true,
      familyRelation: true,
      household: { select: { id: true, householderName: true } },
    },
  },
} as const;

/**
 * 指定世帯の過去帳エントリ一覧 (没年月日 古い順)。
 * 論理削除 (`deletedAt`) は除外する。
 */
export async function listDeathLedgerEntriesByHousehold(
  householdId: string,
): Promise<DeathLedgerEntryWithPerson[]> {
  assertValidUuid(householdId, 'householdId');
  const tenantId = await requireCurrentTenantId();

  return withTenant(tenantId, (tx) =>
    tx.deathLedgerEntry.findMany({
      where: {
        deletedAt: null,
        person: { householdId },
      },
      include: {
        person: {
          select: {
            id: true,
            householdId: true,
            name: true,
            nameKana: true,
            familyRelation: true,
          },
        },
      },
      orderBy: { dateOfDeath: 'asc' },
    }),
  );
}

/**
 * 過去帳エントリを id で取得。論理削除済みは null を返す。
 * Person 情報 (続柄・ふりがな・世帯 ID) も含めて返す (編集画面の初期値や、
 * 保存後のリダイレクト先解決に使用)。
 */
export async function getDeathLedgerEntryById(
  id: string,
): Promise<DeathLedgerEntryWithPerson | null> {
  assertValidUuid(id, 'deathLedgerEntryId');
  const tenantId = await requireCurrentTenantId();

  const entry = await withTenant(tenantId, (tx) =>
    tx.deathLedgerEntry.findUnique({
      where: { id },
      include: {
        person: {
          select: {
            id: true,
            householdId: true,
            name: true,
            nameKana: true,
            familyRelation: true,
          },
        },
      },
    }),
  );

  if (!entry || entry.deletedAt !== null) {
    return null;
  }
  return entry;
}

/**
 * 過去帳の横断一覧 (寺全体)。論理削除は除外する。
 *
 * - `sort='date'`: 命日順 (年→月→日)。月日不明・年のみ判明は末尾に回す。
 * - `sort='kana'`: ふりがな (Person.nameKana) 昇順。
 * - `query` を渡すと、戒名・俗名・ふりがなのあいまい一致で絞り込む
 *   (Wave1-A の正規化を活用し、かなはひらがな寄せして比較)。
 *
 * 命日順の並べ替えは構造化フィールド (deathYear/Month/Day) を使うため
 * アプリ側でソートする (NULL 末尾の安定ソートを DB 非依存で担保する)。
 */
export async function listAllDeathLedgerEntries(options?: {
  sort?: DeathLedgerSort;
  query?: string;
}): Promise<DeathLedgerListItem[]> {
  const sort: DeathLedgerSort = options?.sort ?? 'date';
  const rawQuery = (options?.query ?? '').trim();
  const tenantId = await requireCurrentTenantId();

  const where: Prisma.DeathLedgerEntryWhereInput = { deletedAt: null };
  if (rawQuery.length > 0) {
    const kana = normalizeKana(rawQuery);
    const or: Prisma.DeathLedgerEntryWhereInput[] = [
      { secularName: { contains: rawQuery, mode: 'insensitive' } },
      { kaimyoName: { contains: rawQuery, mode: 'insensitive' } },
    ];
    if (kana.length > 0) {
      // nameKana はひらがな保存前提。検索語もひらがな寄せして部分一致。
      or.push({ person: { is: { nameKana: { contains: kana, mode: 'insensitive' } } } });
    }
    where.OR = or;
  }

  const entries = await withTenant(tenantId, (tx) =>
    tx.deathLedgerEntry.findMany({
      where,
      include: CROSS_LIST_INCLUDE,
      take: 500,
    }),
  );

  if (sort === 'kana') {
    return entries.sort((a, b) =>
      a.person.nameKana.localeCompare(b.person.nameKana, 'ja'),
    );
  }

  return entries.sort((a, b) => {
    const ka = deathDateSortKey({
      year: a.deathYear,
      month: a.deathMonth,
      day: a.deathDay,
    });
    const kb = deathDateSortKey({
      year: b.deathYear,
      month: b.deathMonth,
      day: b.deathDay,
    });
    return (
      ka[0] - kb[0] ||
      ka[1] - kb[1] ||
      ka[2] - kb[2] ||
      a.person.nameKana.localeCompare(b.person.nameKana, 'ja')
    );
  });
}

/** 論理削除 (除外) 済みエントリの一覧。除外日時の新しい順。復元画面で使う。 */
export type DeletedDeathLedgerItem = DeathLedgerListItem & {
  deletedByUser: { id: string; displayName: string } | null;
};

export async function listDeletedDeathLedgerEntries(): Promise<
  DeletedDeathLedgerItem[]
> {
  const tenantId = await requireCurrentTenantId();

  const entries = await withTenant(tenantId, (tx) =>
    tx.deathLedgerEntry.findMany({
      where: { deletedAt: { not: null } },
      include: CROSS_LIST_INCLUDE,
      orderBy: { deletedAt: 'desc' },
      take: 500,
    }),
  );

  // deletedBy は User.id だが FK relation を張っていないため、別途まとめて引く。
  const userIds = Array.from(
    new Set(entries.map((e) => e.deletedBy).filter((v): v is string => v !== null)),
  );
  const users =
    userIds.length === 0
      ? []
      : await withTenant(tenantId, (tx) =>
          tx.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, displayName: true },
          }),
        );
  const userMap = new Map(users.map((u) => [u.id, u]));

  return entries.map((e) => ({
    ...e,
    deletedByUser: e.deletedBy ? userMap.get(e.deletedBy) ?? null : null,
  }));
}

/**
 * 重複登録の警告用: 同一世帯の (生存・除外問わない) 過去帳エントリの俗名候補を返す。
 * `excludeId` は編集中の自分自身を除外する用途。
 */
export async function listHouseholdDeathLedgerNames(
  householdId: string,
  excludeId?: string,
): Promise<{ id: string; secularName: string }[]> {
  assertValidUuid(householdId, 'householdId');
  if (excludeId !== undefined) {
    assertValidUuid(excludeId, 'deathLedgerEntryId');
  }
  const tenantId = await requireCurrentTenantId();

  return withTenant(tenantId, (tx) =>
    tx.deathLedgerEntry.findMany({
      where: {
        deletedAt: null,
        person: { is: { householdId } },
        ...(excludeId !== undefined ? { id: { not: excludeId } } : {}),
      },
      select: { id: true, secularName: true },
    }),
  );
}
