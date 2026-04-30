import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { requireCurrentUser } from '@/lib/auth';
import { GOOGLE_OAUTH_SCOPES } from '@/lib/google/env';
import { createOAuthClient } from '@/lib/google/oauth-client';

// Node ランタイムを明示 (googleapis は Node 専用 API を利用)
export const runtime = 'nodejs';

const STATE_COOKIE = 'google_oauth_state';

/**
 * Google Calendar 連携の OAuth フロー開始。
 * CSRF 対策のため random state を生成し、httpOnly Cookie に保存 → URL にも付与。
 * 同意画面で常に refresh_token を受け取るため `access_type=offline` + `prompt=consent`。
 */
export async function GET(_request: NextRequest): Promise<Response> {
  await requireCurrentUser(); // 未ログインは例外 → middleware 経由で /login に戻る前提

  const state = randomBytes(24).toString('hex');

  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 10, // 10 分
  });

  const oauth = createOAuthClient();
  const url = oauth.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [...GOOGLE_OAUTH_SCOPES],
    state,
    include_granted_scopes: true,
  });

  return NextResponse.redirect(url);
}
