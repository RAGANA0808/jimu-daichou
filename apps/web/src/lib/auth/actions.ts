'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * ログアウト。Server Action 経由で呼び出す。
 * 成功しても失敗しても /login へリダイレクトする。
 */
export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/login');
}
