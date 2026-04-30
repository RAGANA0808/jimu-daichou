import { createBrowserClient } from '@supabase/ssr';
import { supabasePublicConfig } from './env';

/**
 * ブラウザ (Client Component) 用の Supabase クライアント。
 * Cookie は document.cookie 経由で Supabase SDK が管理する。
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    supabasePublicConfig.url(),
    supabasePublicConfig.anonKey(),
  );
}
