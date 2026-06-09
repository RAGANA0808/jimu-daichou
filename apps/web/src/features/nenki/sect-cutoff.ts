import 'server-only';
import { cache } from 'react';
import { requireCurrentTenantId } from '@/lib/auth';
import { withTenant } from '@/lib/db';
import { getSectDefaultCutoff } from '@/lib/nenki';

/**
 * 現テナントの宗派から「既定弔い上げ回忌」を解決する。
 * - React cache() により 1 リクエスト中の複数呼び出しを 1 クエリにデデュープする。
 * - per-entry の memorialCutoffAnniversary が常に優先。これはあくまで fallback。
 * - 宗派未設定 (null) / 曹洞宗等は null = 標準スケジュール (五十回忌まで) で挙動不変。
 */
export const getCurrentTenantSectDefaultCutoff = cache(
  async (): Promise<number | null> => {
    const tenantId = await requireCurrentTenantId();
    const tenant = await withTenant(tenantId, (tx) =>
      tx.tenant.findUnique({
        where: { id: tenantId },
        select: { sect: true },
      }),
    );
    return getSectDefaultCutoff(tenant?.sect ?? null);
  },
);
