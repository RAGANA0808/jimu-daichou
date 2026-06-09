import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 発送クエリ層の withTenant 境界テスト (実 DB 不要)。
 * 「解決済み tenantId で withTenant を経由するか」「外部入力 (id) を UUID 検証してから
 * DB に渡すか」というアプリ層の契約を固定する。
 */

const requireCurrentTenantId = vi.fn();
const withTenant = vi.fn();
const assertValidUuid = vi.fn();
const findAnniversariesForYear = vi.fn();

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

vi.mock('@/features/nenki/queries', () => ({
  findAnniversariesForYear: (year: number) => findAnniversariesForYear(year),
}));

const TENANT_ID = 'a7c71b60-0fab-4cdf-9c66-0f3f7ae3e38e';
const BATCH_ID = 'b1c71b60-0fab-4cdf-9c66-0f3f7ae3e111';

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

describe('listShipmentCandidatesForYear', () => {
  it('同一世帯の複数年忌を 1 宛先にまとめ summary に列挙する', async () => {
    findAnniversariesForYear.mockResolvedValue([
      {
        entryId: 'e-1',
        personId: 'p-1',
        householdId: 'hh-1',
        householdName: '山田',
        secularName: '山田花子',
        anniversary: { name: '三回忌', kaiki: 3 },
      },
      {
        entryId: 'e-2',
        personId: 'p-2',
        householdId: 'hh-1',
        householdName: '山田',
        secularName: '山田一郎',
        anniversary: { name: '七回忌', kaiki: 7 },
      },
    ]);
    const tx = {
      household: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { id: 'hh-1', postalCode: '100-0001', address: '東京都' },
          ]),
      },
      shipmentRecipientItem: { findMany: vi.fn().mockResolvedValue([]) },
    };
    withTenant.mockImplementation((_t, fn) => fn(tx));

    const { listShipmentCandidatesForYear } = await import('./queries');
    const result = await listShipmentCandidatesForYear(2026);

    expect(tenantArgOf()).toBe(TENANT_ID);
    // N+1 解消: household は findMany で 1 回だけ引く
    expect(tx.household.findMany).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
    expect(result[0]!.summary).toBe('山田花子 三回忌、山田一郎 七回忌');
    expect(result[0]!.missingAddress).toBe(false);
    // 既送明細が無いので重複なし
    expect(result[0]!.duplicateState).toBe('none');
    expect(result[0]!.items).toHaveLength(2);
  });

  it('住所未登録の世帯は missingAddress=true', async () => {
    findAnniversariesForYear.mockResolvedValue([
      {
        entryId: 'e-3',
        personId: 'p-3',
        householdId: 'hh-2',
        householdName: '佐藤',
        secularName: '佐藤太郎',
        anniversary: { name: '一周忌', kaiki: 1 },
      },
    ]);
    const tx = {
      household: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: 'hh-2', postalCode: null, address: null }]),
      },
      shipmentRecipientItem: { findMany: vi.fn().mockResolvedValue([]) },
    };
    withTenant.mockImplementation((_t, fn) => fn(tx));

    const { listShipmentCandidatesForYear } = await import('./queries');
    const result = await listShipmentCandidatesForYear(2026);
    expect(result[0]!.missingAddress).toBe(true);
  });

  it('同一対象×同一回忌が既送なら duplicateState=all', async () => {
    findAnniversariesForYear.mockResolvedValue([
      {
        entryId: 'e-4',
        personId: 'p-4',
        householdId: 'hh-3',
        householdName: '鈴木',
        secularName: '鈴木一',
        anniversary: { name: '三回忌', kaiki: 3 },
      },
    ]);
    const tx = {
      household: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { id: 'hh-3', postalCode: '100-0002', address: '東京都港区' },
          ]),
      },
      shipmentRecipientItem: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ targetPersonId: 'p-4', anniversaryKaiki: 3 }]),
      },
    };
    withTenant.mockImplementation((_t, fn) => fn(tx));

    const { listShipmentCandidatesForYear } = await import('./queries');
    const result = await listShipmentCandidatesForYear(2026);
    expect(result[0]!.duplicateState).toBe('all');
    expect(result[0]!.items[0]!.alreadySent).toBe(true);
  });

  it('対象が 0 件なら DB を引かず空配列', async () => {
    findAnniversariesForYear.mockResolvedValue([]);
    const { listShipmentCandidatesForYear } = await import('./queries');
    const result = await listShipmentCandidatesForYear(2026);
    expect(result).toEqual([]);
    expect(withTenant).not.toHaveBeenCalled();
  });
});

describe('getShipmentBatchById', () => {
  it('不正な id は UUID 検証で弾き DB に到達させない', async () => {
    const { getShipmentBatchById } = await import('./queries');
    await expect(
      getShipmentBatchById("'; DROP TABLE \"ShipmentBatch\"; --"),
    ).rejects.toThrow(TypeError);
    expect(withTenant).not.toHaveBeenCalled();
  });

  it('正当な id は withTenant 経由で引く', async () => {
    const tx = {
      shipmentBatch: { findUnique: vi.fn().mockResolvedValue(null) },
    };
    withTenant.mockImplementation((_t, fn) => fn(tx));
    const { getShipmentBatchById } = await import('./queries');
    await getShipmentBatchById(BATCH_ID);
    expect(tenantArgOf()).toBe(TENANT_ID);
  });
});
