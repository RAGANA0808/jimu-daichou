import 'server-only';
import type { Household, Prisma, Tag } from '@prisma/client';
import { requireCurrentTenantId } from '@/lib/auth';
import { assertValidUuid, isValidUuid, withTenant, withTenantOrTx } from '@/lib/db';

export type HouseholdTagFilter = {
  tagIds: string[];
  mode: 'and' | 'or';
};

export type HouseholdWithTags = Household & { tags: Tag[] };

/**
 * 自テナントのタグマスタ一覧。名前昇順 (候補・絞り込みチップ用)。
 */
export async function listTags(tx?: Prisma.TransactionClient): Promise<Tag[]> {
  return withTenantOrTx(tx, requireCurrentTenantId, (t) =>
    t.tag.findMany({
      orderBy: [{ name: 'asc' }],
    }),
  );
}

/**
 * 指定世帯に付与済みのタグ一覧 (名前昇順)。
 */
export async function listHouseholdTags(
  householdId: string,
  tx?: Prisma.TransactionClient,
): Promise<Tag[]> {
  assertValidUuid(householdId, 'householdId');
  const rows = await withTenantOrTx(tx, requireCurrentTenantId, (t) =>
    t.householdTag.findMany({
      where: { householdId },
      include: { tag: true },
      orderBy: { tag: { name: 'asc' } },
    }),
  );
  return rows.map((r) => r.tag);
}

/**
 * 世帯一覧をタグで横断抽出する。
 * - filter なし / tagIds 空: 全件 (既存挙動どおり、isActive のみ)。
 * - OR: いずれかのタグを持つ世帯。
 * - AND: 指定タグを「すべて」持つ世帯 (タグ数ぶんの some を AND 連結)。
 * 各世帯の付与タグも include して返す (一覧チップ表示用)。
 */
export async function listHouseholdsWithTags(
  filter?: HouseholdTagFilter,
): Promise<HouseholdWithTags[]> {
  const tenantId = await requireCurrentTenantId();

  const tagIds = (filter?.tagIds ?? []).filter((id) => isValidUuid(id));
  const mode = filter?.mode === 'and' ? 'and' : 'or';

  const tagWhere =
    tagIds.length === 0
      ? {}
      : mode === 'and'
        ? {
            AND: tagIds.map((id) => ({
              householdTags: { some: { tagId: id } },
            })),
          }
        : { householdTags: { some: { tagId: { in: tagIds } } } };

  const rows = await withTenant(tenantId, (tx) =>
    tx.household.findMany({
      where: { isActive: true, ...tagWhere },
      orderBy: [{ nameKana: 'asc' }, { householderName: 'asc' }],
      take: 100,
      include: {
        householdTags: {
          include: { tag: true },
          orderBy: { tag: { name: 'asc' } },
        },
      },
    }),
  );

  return rows.map(({ householdTags, ...household }) => ({
    ...household,
    tags: householdTags.map((ht) => ht.tag),
  }));
}
