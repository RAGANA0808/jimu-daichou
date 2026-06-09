import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 塔婆クエリ層の withTenant 境界テスト (実 DB 不要)。
 * 「解決済み tenantId で withTenant を経由するか」「外部入力 (id) を UUID 検証してから
 * DB に渡すか」「読上順 (readingOrder 昇順) で並べるか」というアプリ層の契約を固定する。
 */

const requireCurrentTenantId = vi.fn();
const withTenant = vi.fn();
const assertValidUuid = vi.fn();

vi.mock('server-only', () => ({}));

vi.mock('@/lib/auth', () => ({
  requireCurrentTenantId: () => requireCurrentTenantId(),
}));

vi.mock('@/lib/db', () => ({
  withTenant: (tenantId: string, fn: (tx: unknown) => unknown) =>
    withTenant(tenantId, fn),
  assertValidUuid: (value: string, label: string) =>
    assertValidUuid(value, label),
}));

const TENANT_ID = 'a7c71b60-0fab-4cdf-9c66-0f3f7ae3e38e';
const SERVICE_ID = 'b1c71b60-0fab-4cdf-9c66-0f3f7ae3e111';

function makeTx() {
  return {
    toba: { findMany: vi.fn().mockResolvedValue([]) },
    person: { findMany: vi.fn().mockResolvedValue([]) },
  };
}

function tenantArgOf(callIndex = 0): unknown {
  const call = withTenant.mock.calls[callIndex];
  if (!call) throw new Error('withTenant was not called');
  return call[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  requireCurrentTenantId.mockResolvedValue(TENANT_ID);
  assertValidUuid.mockImplementation((value: string) => {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        value,
      )
    ) {
      throw new TypeError(`invalid uuid: ${value}`);
    }
  });
});

describe('listTobasByMemorialService', () => {
  it('解決済み tenantId で withTenant を呼び readingOrder 昇順で引く', async () => {
    const tx = makeTx();
    withTenant.mockImplementation((_t, fn) => fn(tx));
    const { listTobasByMemorialService } = await import('./queries');

    await listTobasByMemorialService(SERVICE_ID);

    expect(tenantArgOf()).toBe(TENANT_ID);
    const call = tx.toba.findMany.mock.calls[0];
    if (!call) throw new Error('findMany was not called');
    const arg = call[0] as {
      where: { memorialServiceId: string };
      orderBy: Array<Record<string, string>>;
    };
    expect(arg.where.memorialServiceId).toBe(SERVICE_ID);
    expect(arg.orderBy[0]).toEqual({ readingOrder: 'asc' });
  });

  it('不正な memorialServiceId は UUID 検証で弾き DB に到達させない', async () => {
    const tx = makeTx();
    withTenant.mockImplementation((_t, fn) => fn(tx));
    const { listTobasByMemorialService } = await import('./queries');

    await expect(
      listTobasByMemorialService("'; DROP TABLE \"Toba\"; --"),
    ).rejects.toThrow(TypeError);
    expect(withTenant).not.toHaveBeenCalled();
  });
});

describe('listTargetPersonCandidates', () => {
  it('故人 (isDeceased) のみを候補に引く', async () => {
    const tx = makeTx();
    withTenant.mockImplementation((_t, fn) => fn(tx));
    const { listTargetPersonCandidates } = await import('./queries');

    await listTargetPersonCandidates(SERVICE_ID);

    const call = tx.person.findMany.mock.calls[0];
    if (!call) throw new Error('findMany was not called');
    const arg = call[0] as { where: { isDeceased: boolean } };
    expect(arg.where.isDeceased).toBe(true);
  });
});
