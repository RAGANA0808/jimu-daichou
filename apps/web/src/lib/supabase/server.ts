import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabasePublicConfig } from './env';

/**
 * Server Component / Server Action / Route Handler 用の Supabase クライアント。
 *
 * Next.js 15 の `cookies()` は非同期。Supabase SDK はこの cookieStore 経由で
 * セッション Cookie を読み書きする。Server Component から呼ばれた場合は
 * Cookie 書込みが無視されるが、`middleware.ts` 側でリフレッシュ済みなので問題ない。
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    supabasePublicConfig.url(),
    supabasePublicConfig.anonKey(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Component から呼ばれたときは cookieStore.set が throw する。
            // middleware.ts でセッションをリフレッシュしているため無視してよい。
          }
        },
      },
    },
  );
}
