import 'server-only';
import type { GraveContract } from '@prisma/client';
import { requireCurrentTenantId } from '@/lib/auth';
import { assertValidUuid, withTenant } from '@/lib/db';

/**
 * 指定区画の有効契約 (deletedAt=null AND status=ACTIVE) を 1 件取得する。
 * 複数 ACTIVE がある異常時は開始日の新しいものを返す。
 */
export async function getActiveGraveContractByPlot(
  gravePlotId: string,
): Promise<GraveContract | null> {
  assertValidUuid(gravePlotId, 'gravePlotId');
  const tenantId = await requireCurrentTenantId();
  return withTenant(tenantId, (tx) =>
    tx.graveContract.findFirst({
      where: { gravePlotId, deletedAt: null, status: 'ACTIVE' },
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
    }),
  );
}

/**
 * 指定区画の契約履歴を取得する (論理削除を除く)。新しい順。
 */
export async function listGraveContractsByPlot(
  gravePlotId: string,
): Promise<GraveContract[]> {
  assertValidUuid(gravePlotId, 'gravePlotId');
  const tenantId = await requireCurrentTenantId();
  return withTenant(tenantId, (tx) =>
    tx.graveContract.findMany({
      where: { gravePlotId, deletedAt: null },
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
    }),
  );
}

/** 1 件取得 (編集画面用)。論理削除済みは null。 */
export async function getGraveContractById(
  id: string,
): Promise<GraveContract | null> {
  assertValidUuid(id, 'graveContractId');
  const tenantId = await requireCurrentTenantId();
  const contract = await withTenant(tenantId, (tx) =>
    tx.graveContract.findUnique({ where: { id } }),
  );
  if (!contract || contract.deletedAt !== null) return null;
  return contract;
}
