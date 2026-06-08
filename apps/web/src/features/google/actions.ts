'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { google } from 'googleapis';
import { requireCapability } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { decryptSecret } from '@/lib/crypto';
import { withTenant } from '@/lib/db';

/**
 * Google Calendar 連携を解除する。
 *
 * - 保存している refresh_token を Google 側で revoke (P-6: 暗号化されていれば復号して使う)
 * - DB からも関連フィールドをクリア
 */
export async function disconnectGoogleCalendarAction(): Promise<void> {
  const user = await requireCapability('destructive');
  const tenantId = user.tenantId;

  const refreshToken = await withTenant(tenantId, async (tx) => {
    const tenant = await tx.tenant.findUnique({
      where: { id: tenantId },
      select: { googleRefreshToken: true },
    });
    // P-6: 保存値は暗号化されている可能性があるため復号して revoke に使う (平文は素通し)。
    const token = tenant?.googleRefreshToken
      ? decryptSecret(tenant.googleRefreshToken) || null
      : null;

    await tx.tenant.update({
      where: { id: tenantId },
      data: {
        googleRefreshToken: null,
        googleConnectedEmail: null,
        googleConnectedAt: null,
      },
    });

    await recordAudit(tx, tenantId, {
      actorId: user.id,
      action: 'DISCONNECT',
      entityType: 'Tenant',
      entityId: tenantId,
      summary: 'Google Calendar 連携を解除',
    });

    return token;
  });

  // revoke は best-effort。失敗しても DB 側のクリアは済んでいる。
  if (refreshToken) {
    try {
      const oauth = new google.auth.OAuth2();
      await oauth.revokeToken(refreshToken);
    } catch {
      // 既に revoke 済みなど、失敗してもユーザー側は連携解除の結果に違いはない
    }
  }

  revalidatePath('/settings');
  redirect('/settings?google_connect=disconnected');
}
