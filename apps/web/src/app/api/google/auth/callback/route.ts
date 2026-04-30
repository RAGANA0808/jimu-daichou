import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { google } from 'googleapis';
import { requireCurrentTenantId } from '@/lib/auth';
import { withTenant } from '@/lib/db';
import { createOAuthClient } from '@/lib/google/oauth-client';

export const runtime = 'nodejs';

const STATE_COOKIE = 'google_oauth_state';

function redirectToSettings(
  request: NextRequest,
  params: Record<string, string>,
): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = '/settings';
  url.search = '?' + new URLSearchParams(params).toString();
  return NextResponse.redirect(url);
}

/**
 * Google OAuth のコールバック。
 * 1. state の整合性チェック (CSRF)
 * 2. code を token (refresh_token 含む) に交換
 * 3. 連携した Google アカウントの email を取得
 * 4. 自テナントの `googleRefreshToken` / `googleConnectedEmail` / `googleConnectedAt` を保存
 */
export async function GET(request: NextRequest): Promise<Response> {
  const url = request.nextUrl;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value ?? null;

  // 使い終わった state cookie は消す
  cookieStore.delete(STATE_COOKIE);

  if (errorParam) {
    return redirectToSettings(request, {
      google_connect: 'error',
      reason: errorParam,
    });
  }

  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectToSettings(request, {
      google_connect: 'error',
      reason: 'invalid_state',
    });
  }

  const tenantId = await requireCurrentTenantId();

  const oauth = createOAuthClient();
  const tokenResponse = await oauth.getToken(code);
  const tokens = tokenResponse.tokens;

  if (!tokens.refresh_token) {
    // prompt=consent を付けていても、過去に同じクライアントで refresh_token を取得済みだと
    // 空で返ることがある。Google Account の権限画面でアプリ連携を解除して再試行する必要あり。
    return redirectToSettings(request, {
      google_connect: 'error',
      reason: 'no_refresh_token',
    });
  }

  // 取得した access_token で連携アカウントの email を取得する
  oauth.setCredentials(tokens);
  const userinfo = await google
    .oauth2({ version: 'v2', auth: oauth })
    .userinfo.get();
  const connectedEmail = userinfo.data.email ?? null;

  await withTenant(tenantId, (tx) =>
    tx.tenant.update({
      where: { id: tenantId },
      data: {
        googleRefreshToken: tokens.refresh_token,
        googleConnectedEmail: connectedEmail,
        googleConnectedAt: new Date(),
      },
    }),
  );

  return redirectToSettings(request, { google_connect: 'success' });
}
