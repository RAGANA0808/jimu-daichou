import 'server-only';
import type { DeathLedgerEntry, Person } from '@prisma/client';
import { requireCurrentTenantId } from '@/lib/auth';
import { assertValidUuid, withTenant } from '@/lib/db';

export type DeathLedgerEntryWithPerson = DeathLedgerEntry & {
  person: Pick<
    Person,
    'id' | 'householdId' | 'name' | 'nameKana' | 'familyRelation'
  >;
};

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
