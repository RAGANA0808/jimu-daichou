'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { google } from 'googleapis';
import { requireCurrentTenantId } from '@/lib/auth';
import { withTenant } from '@/lib/db';

/**
 * Google Calendar 連携を解除する。
 *
 * - 保存している refresh_token を Google 側で revoke
 * - DB からも関連フィールドをクリア
 */
export async function disconnectGoogleCalendarAction(): Promise<void> {
  const tenantId = await requireCurrentTenantId();

  const refreshToken = await withTenant(tenantId, async (tx) => {
    const tenant = await tx.tenant.findUnique({
      where: { id: tenantId },
      select: { googleRefreshToken: true },
    });
    const token = tenant?.googleRefreshToken ?? null;

    await tx.tenant.update({
      where: { id: tenantId },
      data: {
        googleRefreshToken: null,
        googleConnectedEmail: null,
        googleConnectedAt: null,
      },
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
