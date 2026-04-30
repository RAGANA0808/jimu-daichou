import 'server-only';
import type { GravePlot, GravePlotArea, Household } from '@prisma/client';
import { requireCurrentTenantId } from '@/lib/auth';
import { assertValidUuid, withTenant } from '@/lib/db';

export type GravePlotWithRelations = GravePlot & {
  household: Pick<Household, 'id' | 'householderName'> | null;
  area: Pick<GravePlotArea, 'id' | 'name'> | null;
};

/**
 * 区画一覧。plotNumber 昇順。
 * 離檀した世帯の区画でも household が null になる場合あり (FK は維持)。
 */
export async function listGravePlots(options?: {
  areaId?: string | null;
}): Promise<GravePlotWithRelations[]> {
  const tenantId = await requireCurrentTenantId();
  const where =
    options && 'areaId' in options ? { areaId: options.areaId ?? null } : {};
  return withTenant(tenantId, (tx) =>
    tx.gravePlot.findMany({
      where,
      include: {
        household: { select: { id: true, householderName: true } },
        area: { select: { id: true, name: true } },
      },
      orderBy: { plotNumber: 'asc' },
    }),
  );
}

/**
 * 指定世帯が契約中の区画一覧 (世帯詳細ページ用)。
 * 墓じまい済 (CLOSED) も含む (履歴参照)。
 */
export async function listGravePlotsByHousehold(
  householdId: string,
): Promise<GravePlotWithRelations[]> {
  assertValidUuid(householdId, 'householdId');
  const tenantId = await requireCurrentTenantId();
  return withTenant(tenantId, (tx) =>
    tx.gravePlot.findMany({
      where: { householdId },
      include: {
        household: { select: { id: true, householderName: true } },
        area: { select: { id: true, name: true } },
      },
      orderBy: { plotNumber: 'asc' },
    }),
  );
}

export async function getGravePlotById(
  id: string,
): Promise<GravePlotWithRelations | null> {
  assertValidUuid(id, 'gravePlotId');
  const tenantId = await requireCurrentTenantId();
  return withTenant(tenantId, (tx) =>
    tx.gravePlot.findUnique({
      where: { id },
      include: {
        household: { select: { id: true, householderName: true } },
        area: { select: { id: true, name: true } },
      },
    }),
  );
}

export async function listHouseholdsForSelect(): Promise<
  Array<Pick<Household, 'id' | 'householderName' | 'nameKana'>>
> {
  const tenantId = await requireCurrentTenantId();
  return withTenant(tenantId, (tx) =>
    tx.household.findMany({
      select: { id: true, householderName: true, nameKana: true },
      orderBy: { nameKana: 'asc' },
    }),
  );
}
