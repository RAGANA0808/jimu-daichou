import 'server-only';
import type { Person, Toba } from '@prisma/client';
import { requireCurrentTenantId } from '@/lib/auth';
import { assertValidUuid, withTenant } from '@/lib/db';

export type TobaWithTarget = Toba & {
  targetPerson: Pick<Person, 'id' | 'name' | 'nameKana'> | null;
};

/**
 * 指定法要の塔婆申込を読上順 (readingOrder 昇順 → createdAt 昇順) で取得する。
 */
export async function listTobasByMemorialService(
  memorialServiceId: string,
): Promise<TobaWithTarget[]> {
  assertValidUuid(memorialServiceId, 'memorialServiceId');
  const tenantId = await requireCurrentTenantId();
  return withTenant(tenantId, (tx) =>
    tx.toba.findMany({
      where: { memorialServiceId },
      include: {
        targetPerson: { select: { id: true, name: true, nameKana: true } },
      },
      orderBy: [{ readingOrder: 'asc' }, { createdAt: 'asc' }],
    }),
  );
}

/**
 * 単一の塔婆申込を取得 (編集フォーム用)。他テナントの id は RLS で非表示。
 */
export async function getTobaById(id: string): Promise<Toba | null> {
  assertValidUuid(id, 'tobaId');
  const tenantId = await requireCurrentTenantId();
  return withTenant(tenantId, (tx) =>
    tx.toba.findUnique({ where: { id } }),
  );
}

/**
 * 法要主催世帯に属する故人 (過去帳に載っている故人) を対象故人候補として返す。
 * 対象故人の指定は任意なので、候補が空でも申込は可能。
 */
export async function listTargetPersonCandidates(
  householdId: string,
): Promise<Array<Pick<Person, 'id' | 'name' | 'nameKana'>>> {
  assertValidUuid(householdId, 'householdId');
  const tenantId = await requireCurrentTenantId();
  return withTenant(tenantId, (tx) =>
    tx.person.findMany({
      where: { householdId, isDeceased: true },
      select: { id: true, name: true, nameKana: true },
      orderBy: { nameKana: 'asc' },
    }),
  );
}
