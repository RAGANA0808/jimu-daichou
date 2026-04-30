import { NextResponse, type NextRequest } from 'next/server';
import { adminPrisma } from '@/lib/db/admin-client';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Magic Link / OAuth 共通の着地点。
 *
 * 1. `?code=...` を受け取り、Supabase セッションに交換する
 * 2. Supabase 認証ユーザーの email を使い、自前 User 行を解決する
 * 3. 初回ログイン時は `supabaseUserId` をバインドする
 * 4. プロビジョニング未了なら signOut + エラーで /login へ戻す
 *
 * エラー時はクエリ文字列 `?error=<code>` で /login に戻し、画面側で日本語に変換する。
 */
function redirectTo(request: NextRequest, path: string): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = path;
  url.search = '';
  return NextResponse.redirect(url);
}

function redirectToLoginError(
  request: NextRequest,
  errorCode: string,
): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.search = `?error=${encodeURIComponent(errorCode)}`;
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const code = request.nextUrl.searchParams.get('code');
  const nextParam = request.nextUrl.searchParams.get('next');
  const nextPath =
    nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//')
      ? nextParam
      : '/dashboard';

  if (!code) {
    return redirectToLoginError(request, 'invalid_code');
  }

  const supabase = await createSupabaseServerClient();
  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    return redirectToLoginError(request, 'exchange_failed');
  }

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser || !authUser.email) {
    return redirectToLoginError(request, 'session_lost');
  }

  const authEmail = authUser.email.toLowerCase();

  // 1) supabaseUserId でバインド済みユーザーを探す (通常ログイン)
  const boundUser = await adminPrisma.user.findUnique({
    where: { supabaseUserId: authUser.id },
  });
  if (boundUser) {
    return redirectTo(request, nextPath);
  }

  // 2) 初回ログイン or 未バインド。email で自前 User を引く
  const userByEmail = await adminPrisma.user.findFirst({
    where: { email: authEmail },
  });
  if (!userByEmail) {
    // 自前テーブルに存在しない → プロビジョニング未了として拒否
    await supabase.auth.signOut();
    return redirectToLoginError(request, 'not_provisioned');
  }

  // 3) 他の Supabase user に紐づいていた場合は衝突として拒否 (運用事故防止)
  if (
    userByEmail.supabaseUserId &&
    userByEmail.supabaseUserId !== authUser.id
  ) {
    await supabase.auth.signOut();
    return redirectToLoginError(request, 'binding_conflict');
  }

  // 4) 未バインドなのでバインドする
  if (!userByEmail.supabaseUserId) {
    await adminPrisma.user.update({
      where: { id: userByEmail.id },
      data: { supabaseUserId: authUser.id },
    });
  }

  return redirectTo(request, nextPath);
}
