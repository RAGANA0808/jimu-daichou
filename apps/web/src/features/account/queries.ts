import 'server-only';
import type { UserRole } from '@prisma/client';
import { requireCurrentUser } from '@/lib/auth';

export type CurrentUserProfile = {
  id: string;
  displayName: string;
  email: string;
  role: UserRole;
};

/**
 * ログイン中ユーザー自身のプロフィール情報を返す。
 * 認証ブートストラップ済みの User 行をそのまま使う (テナント解決前の問いではないが、
 * supabaseUserId 一意検索で自分の行のみが得られるため他人を取得する余地はない)。
 */
export async function getCurrentUserProfile(): Promise<CurrentUserProfile> {
  const user = await requireCurrentUser();
  return {
    id: user.id,
    displayName: user.displayName,
    email: user.email,
    role: user.role,
  };
}
