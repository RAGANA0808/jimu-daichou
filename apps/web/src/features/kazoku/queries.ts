import 'server-only';
import type { Person } from '@prisma/client';
import { requireCurrentTenantId } from '@/lib/auth';
import { assertValidUuid, withTenant } from '@/lib/db';

/**
 * 指定世帯の生存している家族構成員を一覧取得 (isDeceased=false)。
 * 過去帳に載る故人は含まない (過去帳セクションで別途表示)。
 * 並び: 続柄があるものを先に (fallback は nameKana 昇順)。
 */
export async function listLivingMembersByHousehold(
  householdId: string,
): Promise<Person[]> {
  assertValidUuid(householdId, 'householdId');
  const tenantId = await requireCurrentTenantId();

  return withTenant(tenantId, (tx) =>
    tx.person.findMany({
      where: { householdId, isDeceased: false },
      orderBy: [
        { familyRelation: { sort: 'asc', nulls: 'last' } },
        { nameKana: 'asc' },
      ],
    }),
  );
}

/**
 * Person を id で取得 (家族構成員の編集用)。
 * 故人 (isDeceased=true) は null を返す — 編集は過去帳側で行うため。
 */
export async function getLivingMemberById(
  id: string,
): Promise<Person | null> {
  assertValidUuid(id, 'personId');
  const tenantId = await requireCurrentTenantId();

  const person = await withTenant(tenantId, (tx) =>
    tx.person.findUnique({ where: { id } }),
  );
  if (!person || person.isDeceased) return null;
  return person;
}
