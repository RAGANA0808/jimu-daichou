import 'server-only';
import type { GravePlotArea } from '@prisma/client';
import { requireCurrentTenantId } from '@/lib/auth';
import { assertValidUuid, withTenant } from '@/lib/db';

export type GravePlotAreaWithCount = GravePlotArea & {
  _count: { gravePlots: number };
};

/**
 * 全エリア一覧 (配下区画数付き)。sortOrder 昇順 → createdAt 昇順。
 */
export async function listGravePlotAreas(): Promise<GravePlotAreaWithCount[]> {
  const tenantId = await requireCurrentTenantId();
  return withTenant(tenantId, (tx) =>
    tx.gravePlotArea.findMany({
      include: { _count: { select: { gravePlots: true } } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    }),
  );
}

export async function getGravePlotAreaById(
  id: string,
): Promise<GravePlotArea | null> {
  assertValidUuid(id, 'gravePlotAreaId');
  const tenantId = await requireCurrentTenantId();
  return withTenant(tenantId, (tx) =>
    tx.gravePlotArea.findUnique({ where: { id } }),
  );
}

/**
 * 区画フォームのエリア select / 地図タブ用。
 */
export async function listGravePlotAreasForSelect(): Promise<
  Array<Pick<GravePlotArea, 'id' | 'name' | 'sortOrder'>>
> {
  const tenantId = await requireCurrentTenantId();
  return withTenant(tenantId, (tx) =>
    tx.gravePlotArea.findMany({
      select: { id: true, name: true, sortOrder: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    }),
  );
}
