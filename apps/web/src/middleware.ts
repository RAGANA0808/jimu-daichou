import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// 認証・セッションリフレッシュのためのミドルウェア。
// 未ログインで保護領域にアクセスすると /login へリダイレクトする。
// ログイン済みで /login にアクセスすると /dashboard へリダイレクトする。
export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // 静的アセットは対象外 (Cookie リフレッシュ不要)。
  // /api/auth/** はコールバック自身が Cookie を書き換えるため middleware 側では触らない。
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/auth|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
