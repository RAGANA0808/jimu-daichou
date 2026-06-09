import 'server-only';
import type { User } from '@prisma/client';
import { adminPrisma } from '@/lib/db/admin-client';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Supabase セッション → 自前 User 行の解決。
 *
 * 認証ブートストラップに限定して adminPrisma (RLS bypass) を使用する。
 * 「この Supabase Auth ユーザーはどのテナントに属するのか」という問いは
 * tenantId 解決前の問い合わせであり、仕組み上 withTenant() では縛れないため。
 *
 * - 初回ログイン時の `supabaseUserId` バインドは `/api/auth/callback` 側で実施する。
 * - 本関数は binding 済みの前提で `supabaseUserId` による一意検索のみ行う。
 */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return null;
  }

  return adminPrisma.user.findUnique({
    where: { supabaseUserId: authUser.id },
  });
}

/**
 * ログイン必須の Server Action / Server Component の入口で使う。
 * 未ログイン、または無効化 (isActive=false) されたユーザーなら例外を投げる。
 *
 * 【締め出し厳禁との整合】最後の有効な HEAD_PRIEST は
 * 役割管理アクション (role-management-actions.ts) のガードで無効化を禁止しているため、
 * ここで isActive を弾いても現在の唯一ユーザー (HEAD_PRIEST, isActive=true) は影響を受けない。
 */
export async function requireCurrentUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('認証が必要です。');
  }
  if (!user.isActive) {
    throw new Error('このアカウントは無効化されています。');
  }
  return user;
}

/**
 * 現在ログイン中のユーザーが属するテナント ID を返す。
 * `withTenant(tenantId, ...)` の引数として使う想定。
 */
export async function getCurrentTenantId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.tenantId ?? null;
}

/**
 * Server Actions 等、テナント ID が必須の経路で使う。
 * 未ログインなら例外を投げる。
 */
export async function requireCurrentTenantId(): Promise<string> {
  const user = await requireCurrentUser();
  return user.tenantId;
}
