import 'server-only';
import { cache } from 'react';
import type { Prisma } from '@prisma/client';
import { requireCurrentTenantId } from '@/lib/auth';
import { withTenantOrTx } from '@/lib/db';
import { getSectDefaultCutoff } from '@/lib/nenki';

/**
 * 現テナントの宗派から「既定弔い上げ回忌」を解決する。
 * - React cache() により 1 リクエスト中の複数呼び出しを 1 クエリにデデュープする。
 * - per-entry の memorialCutoffAnniversary が常に優先。これはあくまで fallback。
 * - 宗派未設定 (null) / 曹洞宗等は null = 標準スケジュール (五十回忌まで) で挙動不変。
 */
export const getCurrentTenantSectDefaultCutoff = cache(
  async (tx?: Prisma.TransactionClient): Promise<number | null> => {
    // RLS (tenant_isolation) により tx 内では自テナントの Tenant 1 行のみ可視。
    // 単独経路では withTenantOrTx が認可 + 専用 tx を張る。
    const tenant = await withTenantOrTx(tx, requireCurrentTenantId, (t) =>
      t.tenant.findFirst({ select: { sect: true } }),
    );
    return getSectDefaultCutoff(tenant?.sect ?? null);
  },
);
