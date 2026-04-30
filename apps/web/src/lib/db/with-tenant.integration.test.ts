import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from './client';
import { withTenant } from './with-tenant';

/**
 * RLS 境界の統合テスト (実 DB 接続必須)。
 *
 * 実行: `pnpm --filter @jimu-daichou/web test:integration`
 *
 * 接続モデル:
 * - `prisma` (default export) は DATABASE_URL 経由で NOBYPASSRLS の jimu_app ロールで接続する。
 *   本番 Server Actions と同じ条件で RLS 境界を検証するため。
 * - `adminPrisma` は DIRECT_URL 経由で postgres ロールで接続し、RLS を bypass する。
 *   テストデータの INSERT/DELETE はアプリの権限範囲外なのでこちらで行う。
 */

const adminPrisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL } },
});

const TENANT_A_ID = randomUUID();
const TENANT_B_ID = randomUUID();
const HOUSEHOLD_A_ID = randomUUID();
const HOUSEHOLD_B_ID = randomUUID();

async function cleanup(): Promise<void> {
  await adminPrisma.$executeRawUnsafe(
    `DELETE FROM "Household" WHERE "tenantId" IN ('${TENANT_A_ID}', '${TENANT_B_ID}')`,
  );
  await adminPrisma.$executeRawUnsafe(
    `DELETE FROM "Tenant" WHERE id IN ('${TENANT_A_ID}', '${TENANT_B_ID}')`,
  );
}

beforeAll(async () => {
  await cleanup();
  await adminPrisma.$executeRawUnsafe(
    `INSERT INTO "Tenant" (id, name, slug, "createdAt", "updatedAt")
     VALUES ('${TENANT_A_ID}', 'テスト寺A', 'test-tenant-a-${TENANT_A_ID.slice(0, 8)}', NOW(), NOW()),
            ('${TENANT_B_ID}', 'テスト寺B', 'test-tenant-b-${TENANT_B_ID.slice(0, 8)}', NOW(), NOW())`,
  );
  await adminPrisma.$executeRawUnsafe(
    `INSERT INTO "Household" (id, "tenantId", "householderName", "nameKana", "isActive", "createdAt", "updatedAt")
     VALUES ('${HOUSEHOLD_A_ID}', '${TENANT_A_ID}', 'A家', 'エーけ', true, NOW(), NOW()),
            ('${HOUSEHOLD_B_ID}', '${TENANT_B_ID}', 'B家', 'ビーけ', true, NOW(), NOW())`,
  );
});

afterAll(async () => {
  await cleanup();
  await adminPrisma.$disconnect();
  await prisma.$disconnect();
});

describe('withTenant + RLS 境界', () => {
  it('withTenant(A) で findMany すると A の世帯のみ返る', async () => {
    const rows = await withTenant(TENANT_A_ID, async (tx) => {
      return tx.household.findMany({
        where: { id: { in: [HOUSEHOLD_A_ID, HOUSEHOLD_B_ID] } },
      });
    });
    expect(rows.map((r) => r.id)).toEqual([HOUSEHOLD_A_ID]);
  });

  it('withTenant(B) で findMany すると B の世帯のみ返る', async () => {
    const rows = await withTenant(TENANT_B_ID, async (tx) => {
      return tx.household.findMany({
        where: { id: { in: [HOUSEHOLD_A_ID, HOUSEHOLD_B_ID] } },
      });
    });
    expect(rows.map((r) => r.id)).toEqual([HOUSEHOLD_B_ID]);
  });

  it('withTenant(A) 内で他テナント (B) の tenantId を書込むと WITH CHECK で失敗する', async () => {
    const attemptId = randomUUID();
    await expect(
      withTenant(TENANT_A_ID, async (tx) => {
        return tx.household.create({
          data: {
            id: attemptId,
            tenantId: TENANT_B_ID,
            householderName: '不正書込試行',
            nameKana: 'ふせいかきこみしこう',
          },
        });
      }),
    ).rejects.toThrow();

    // RLS を bypass できる adminPrisma でレコードが作られていないことを確認
    const leaked = await adminPrisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM "Household" WHERE id = '${attemptId}'`,
    );
    expect(leaked).toHaveLength(0);
  });

  it('不正 UUID は即座に弾く (DB に到達させない)', async () => {
    await expect(
      withTenant("'; DROP TABLE \"Household\"; --", async (tx) => {
        return tx.household.findMany();
      }),
    ).rejects.toThrow(TypeError);
  });

  it('withTenant 外から findMany しても他テナントのデータは返らない (最終防衛線)', async () => {
    // jimu_app は NOBYPASSRLS なので、app.current_tenant_id が未設定の状態では
    // RLS ポリシー `tenantId = current_setting(..., true)::uuid` の右辺が NULL になり、
    // どの行ともマッチしない (= 0 行)。withTenant() の呼び忘れに対する最終防衛線。
    const rows = await prisma.household.findMany({
      where: { id: { in: [HOUSEHOLD_A_ID, HOUSEHOLD_B_ID] } },
    });
    expect(rows).toHaveLength(0);
  });
});
