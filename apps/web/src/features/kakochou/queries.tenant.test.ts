import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 過去帳横断クエリ層の withTenant 境界テスト (実 DB 不要)。
 *
 * RLS の実挙動は `lib/db/with-tenant.integration.test.ts` で検証済み。ここでは
 * 「クエリが必ず withTenant(解決済み tenantId, ...) を経由するか」「論理削除の
 * フィルタ条件が正しいか」「外部入力 (householdId) を UUID 検証してから DB に
 * 渡すか」というアプリ層の境界契約を、依存をモックして高速に固定する。
 */

const requireCurrentTenantId = vi.fn();
const withTenant = vi.fn();
const assertValidUuid = vi.fn();

// queries.ts は `import 'server-only'` を持つ。テスト (node) では副作用 import を無効化する。
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

/** withTenant に渡された fn が叩く Prisma クライアントの最小モック。 */
function makeTx(findManyResult: unknown[] = []) {
  return {
    deathLedgerEntry: { findMany: vi.fn().mockResolvedValue(findManyResult) },
    user: { findMany: vi.fn().mockResolvedValue([]) },
  };
}

/** withTenant の第 1 引数 (解決済み tenantId) を型安全に取り出す。 */
function tenantArgOf(callIndex = 0): unknown {
  const call = withTenant.mock.calls[callIndex];
  if (!call) throw new Error('withTenant was not called');
  return call[0];
}

/** findMany の第 1 引数の where を型安全に取り出す。 */
function whereOf(tx: ReturnType<typeof makeTx>) {
  const call = tx.deathLedgerEntry.findMany.mock.calls[0];
  if (!call) throw new Error('findMany was not called');
  return (call[0] as { where: Record<string, unknown> }).where;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireCurrentTenantId.mockResolvedValue(TENANT_ID);
  assertValidUuid.mockImplementation((value: string) => {
    // 実装と同じく不正値は弾く (DB 到達前)。
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
      throw new TypeError(`invalid uuid: ${value}`);
    }
  });
});

describe('listAllDeathLedgerEntries', () => {
  it('解決済み tenantId で withTenant を呼び、論理削除を除外する', async () => {
    const tx = makeTx();
    withTenant.mockImplementation((_tenantId, fn) => fn(tx));
    const { listAllDeathLedgerEntries } = await import('./queries');

    await listAllDeathLedgerEntries({ sort: 'date' });

    expect(withTenant).toHaveBeenCalledTimes(1);
    expect(tenantArgOf()).toBe(TENANT_ID);
    expect(whereOf(tx).deletedAt).toBeNull();
  });

  it('検索語があると戒名・俗名・ふりがなの OR 条件を組む', async () => {
    const tx = makeTx();
    withTenant.mockImplementation((_tenantId, fn) => fn(tx));
    const { listAllDeathLedgerEntries } = await import('./queries');

    await listAllDeathLedgerEntries({ query: 'やまだ' });

    const where = whereOf(tx);
    expect(where.deletedAt).toBeNull();
    expect(Array.isArray(where.OR)).toBe(true);
    expect((where.OR as unknown[]).length).toBeGreaterThanOrEqual(2);
  });
});

describe('listDeletedDeathLedgerEntries', () => {
  it('解決済み tenantId で withTenant を呼び、除外済み (deletedAt != null) のみ引く', async () => {
    const tx = makeTx();
    withTenant.mockImplementation((_tenantId, fn) => fn(tx));
    const { listDeletedDeathLedgerEntries } = await import('./queries');

    await listDeletedDeathLedgerEntries();

    expect(tenantArgOf()).toBe(TENANT_ID);
    expect(whereOf(tx).deletedAt).toEqual({ not: null });
  });
});

describe('listHouseholdDeathLedgerNames', () => {
  it('不正な householdId は UUID 検証で弾き、DB に到達させない', async () => {
    const tx = makeTx();
    withTenant.mockImplementation((_tenantId, fn) => fn(tx));
    const { listHouseholdDeathLedgerNames } = await import('./queries');

    await expect(
      listHouseholdDeathLedgerNames("'; DROP TABLE \"Person\"; --"),
    ).rejects.toThrow(TypeError);

    expect(withTenant).not.toHaveBeenCalled();
    expect(tx.deathLedgerEntry.findMany).not.toHaveBeenCalled();
  });

  it('正しい householdId なら withTenant 経由で論理削除を除外して引く', async () => {
    const tx = makeTx();
    withTenant.mockImplementation((_tenantId, fn) => fn(tx));
    const { listHouseholdDeathLedgerNames } = await import('./queries');

    await listHouseholdDeathLedgerNames(TENANT_ID);

    expect(tenantArgOf()).toBe(TENANT_ID);
    const where = whereOf(tx);
    expect(where.deletedAt).toBeNull();
    expect(where.person).toEqual({ is: { householdId: TENANT_ID } });
  });
});
