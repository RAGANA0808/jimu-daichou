import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { supabasePublicConfig } from './env';

/**
 * middleware.ts から使うセッションリフレッシュ処理。
 *
 * - Supabase のアクセストークンは短命なので、毎リクエストで自動リフレッシュする。
 * - リフレッシュ後の Cookie は NextResponse に載せ替えて返す。
 * - ログイン要否の判定もここで行い、未ログインで保護領域に来たら /login へリダイレクトする。
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    supabasePublicConfig.url(),
    supabasePublicConfig.anonKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getUser() を呼ぶことでアクセストークンが検証 & 必要ならリフレッシュされる。
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const url = request.nextUrl;
  const isAuthRoute =
    url.pathname.startsWith('/login') ||
    url.pathname.startsWith('/api/auth');

  if (!user && !isAuthRoute) {
    const loginUrl = url.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('next', url.pathname + url.search);
    return NextResponse.redirect(loginUrl);
  }

  if (user && url.pathname === '/login') {
    const dashboardUrl = url.clone();
    dashboardUrl.pathname = '/dashboard';
    dashboardUrl.search = '';
    return NextResponse.redirect(dashboardUrl);
  }

  return response;
}
