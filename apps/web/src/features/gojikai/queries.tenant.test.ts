import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 護持会費クエリ層の withTenant 境界テスト (実 DB 不要)。
 * 「解決済み tenantId で withTenant を経由するか」「外部入力 (id) を UUID 検証してから
 * DB に渡すか」というアプリ層の契約を固定する。
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
  // 集約経路 (問題A 根治) のヘルパ。実体と同じく tx があれば相乗り、無ければ
  // resolveTenantId() で解決してから withTenant を張る。
  withTenantOrTx: async (
    tx: unknown,
    resolveTenantId: () => Promise<string>,
    fn: (tx: unknown) => unknown,
  ) => (tx ? fn(tx) : withTenant(await resolveTenantId(), fn)),
  assertValidUuid: (value: string, label: string) =>
    assertValidUuid(value, label),
}));

const TENANT_ID = 'a7c71b60-0fab-4cdf-9c66-0f3f7ae3e38e';
const INVOICE_ID = 'b1c71b60-0fab-4cdf-9c66-0f3f7ae3e111';
const HOUSEHOLD_ID = 'c2c71b60-0fab-4cdf-9c66-0f3f7ae3e222';

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

describe('getInvoiceById', () => {
  it('不正な id は UUID 検証で弾き DB に到達させない', async () => {
    const { getInvoiceById } = await import('./queries');
    await expect(
      getInvoiceById("'; DROP TABLE \"MaintenanceFeeInvoice\"; --"),
    ).rejects.toThrow(TypeError);
    expect(withTenant).not.toHaveBeenCalled();
  });

  it('正当な id は解決済み tenantId で withTenant を経由する', async () => {
    const tx = {
      maintenanceFeeInvoice: { findUnique: vi.fn().mockResolvedValue(null) },
    };
    withTenant.mockImplementation((_t, fn) => fn(tx));
    const { getInvoiceById } = await import('./queries');
    await getInvoiceById(INVOICE_ID);
    expect(tenantArgOf()).toBe(TENANT_ID);
    expect(tx.maintenanceFeeInvoice.findUnique).toHaveBeenCalledTimes(1);
  });
});

describe('getFiscalYearView', () => {
  it('解決済み tenantId で withTenant を経由し集計を返す', async () => {
    const tx = {
      maintenanceFeeInvoice: {
        findMany: vi.fn().mockResolvedValue([
          {
            amount: 10000,
            paidAmount: 10000,
            status: 'PAID',
            household: { id: 'h', householderName: '山田' },
          },
        ]),
      },
    };
    withTenant.mockImplementation((_t, fn) => fn(tx));
    const { getFiscalYearView } = await import('./queries');
    const view = await getFiscalYearView(2026);
    expect(tenantArgOf()).toBe(TENANT_ID);
    expect(view.summary.invoiceCount).toBe(1);
    expect(view.summary.collectionRate).toBe(100);
  });
});

describe('listInvoicesByHousehold', () => {
  it('不正な householdId は弾く', async () => {
    const { listInvoicesByHousehold } = await import('./queries');
    await expect(listInvoicesByHousehold('not-a-uuid')).rejects.toThrow(
      TypeError,
    );
    expect(withTenant).not.toHaveBeenCalled();
  });

  it('正当な householdId は withTenant を経由する', async () => {
    const tx = {
      maintenanceFeeInvoice: { findMany: vi.fn().mockResolvedValue([]) },
    };
    withTenant.mockImplementation((_t, fn) => fn(tx));
    const { listInvoicesByHousehold } = await import('./queries');
    await listInvoicesByHousehold(HOUSEHOLD_ID);
    expect(tenantArgOf()).toBe(TENANT_ID);
  });

  it('tx を渡すと withTenant を張らず渡された tx で実行する (集約経路)', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const tx = { maintenanceFeeInvoice: { findMany } };
    const { listInvoicesByHousehold } = await import('./queries');
    await listInvoicesByHousehold(HOUSEHOLD_ID, tx as never);
    // 集約経路では新しいトランザクション (withTenant) を張らないことが要点。
    expect(withTenant).not.toHaveBeenCalled();
    expect(findMany).toHaveBeenCalledTimes(1);
  });
});

describe('listDunningCandidatesForYear', () => {
  it('未納・一部入金のみを抽出し未納額を計算する', async () => {
    const tx = {
      maintenanceFeeInvoice: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: INVOICE_ID,
            householdId: HOUSEHOLD_ID,
            amount: 10000,
            paidAmount: 3000,
            status: 'PARTIAL',
            household: {
              id: HOUSEHOLD_ID,
              householderName: '佐藤',
              postalCode: null,
              address: null,
            },
          },
        ]),
      },
    };
    withTenant.mockImplementation((_t, fn) => fn(tx));
    const { listDunningCandidatesForYear } = await import('./queries');
    const result = await listDunningCandidatesForYear(2026);
    expect(tenantArgOf()).toBe(TENANT_ID);
    expect(result).toHaveLength(1);
    expect(result[0]!.outstanding).toBe(7000);
    expect(result[0]!.missingAddress).toBe(true);
  });
});
