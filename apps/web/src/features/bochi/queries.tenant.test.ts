import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 墓地 年間管理料 (E27) クエリ層の withTenant 境界テスト (実 DB 不要)。
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
  assertValidUuid: (value: string, label: string) =>
    assertValidUuid(value, label),
}));

const TENANT_ID = 'a7c71b60-0fab-4cdf-9c66-0f3f7ae3e38e';
const INVOICE_ID = 'b1c71b60-0fab-4cdf-9c66-0f3f7ae3e111';
const PLOT_ID = 'c2c71b60-0fab-4cdf-9c66-0f3f7ae3e222';

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
      getInvoiceById("'; DROP TABLE \"GraveMaintenanceInvoice\"; --"),
    ).rejects.toThrow(TypeError);
    expect(withTenant).not.toHaveBeenCalled();
  });

  it('正当な id は解決済み tenantId で withTenant を経由する', async () => {
    const tx = {
      graveMaintenanceInvoice: { findUnique: vi.fn().mockResolvedValue(null) },
    };
    withTenant.mockImplementation((_t, fn) => fn(tx));
    const { getInvoiceById } = await import('./queries');
    await getInvoiceById(INVOICE_ID);
    expect(tenantArgOf()).toBe(TENANT_ID);
    expect(tx.graveMaintenanceInvoice.findUnique).toHaveBeenCalledTimes(1);
  });
});

describe('getFiscalYearView', () => {
  it('解決済み tenantId で withTenant を経由し集計を返す', async () => {
    const tx = {
      graveMaintenanceInvoice: {
        findMany: vi.fn().mockResolvedValue([
          {
            amount: 12000,
            paidAmount: 12000,
            status: 'PAID',
            gravePlot: { id: 'p', plotNumber: 'A-1', household: null },
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

describe('listInvoicesByPlot', () => {
  it('不正な gravePlotId は弾く', async () => {
    const { listInvoicesByPlot } = await import('./queries');
    await expect(listInvoicesByPlot('not-a-uuid')).rejects.toThrow(TypeError);
    expect(withTenant).not.toHaveBeenCalled();
  });

  it('正当な gravePlotId は withTenant を経由する', async () => {
    const tx = {
      graveMaintenanceInvoice: { findMany: vi.fn().mockResolvedValue([]) },
    };
    withTenant.mockImplementation((_t, fn) => fn(tx));
    const { listInvoicesByPlot } = await import('./queries');
    await listInvoicesByPlot(PLOT_ID);
    expect(tenantArgOf()).toBe(TENANT_ID);
  });
});

describe('listDelinquentPlots', () => {
  it('滞納区画を集計し区画・契約世帯情報を補完する', async () => {
    const tx = {
      graveMaintenanceInvoice: {
        findMany: vi.fn().mockResolvedValue([
          {
            gravePlotId: PLOT_ID,
            fiscalYear: 2025,
            amount: 12000,
            paidAmount: 3000,
            status: 'PARTIAL',
          },
        ]),
      },
      gravePlot: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: PLOT_ID,
            plotNumber: 'A-1',
            household: {
              id: 'hh',
              householderName: '佐藤',
              postalCode: null,
              address: null,
            },
          },
        ]),
      },
    };
    withTenant.mockImplementation((_t, fn) => fn(tx));
    const { listDelinquentPlots } = await import('./queries');
    const result = await listDelinquentPlots(2026);
    expect(tenantArgOf()).toBe(TENANT_ID);
    expect(result).toHaveLength(1);
    expect(result[0]!.plotNumber).toBe('A-1');
    expect(result[0]!.totalOutstanding).toBe(9000);
    expect(result[0]!.elapsedYears).toBe(2);
    expect(result[0]!.missingAddress).toBe(true);
    expect(result[0]!.missingHousehold).toBe(false);
  });

  it('滞納がなければ空配列 (区画引きを行わない)', async () => {
    const tx = {
      graveMaintenanceInvoice: { findMany: vi.fn().mockResolvedValue([]) },
      gravePlot: { findMany: vi.fn() },
    };
    withTenant.mockImplementation((_t, fn) => fn(tx));
    const { listDelinquentPlots } = await import('./queries');
    const result = await listDelinquentPlots(2026);
    expect(result).toEqual([]);
    expect(tx.gravePlot.findMany).not.toHaveBeenCalled();
  });
});
