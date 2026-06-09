import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { supabasePublicConfig, supabaseServerConfig } from '@/lib/supabase/env';

/**
 * service-role キーを使う Supabase クライアント (Storage 操作専用)。
 *
 * 【厳守】このクライアントは RLS を完全にバイパスする。Server Action の
 * requireCapability + withTenant + テナント名前空間パス (tenantId/...) でのみ
 * テナント境界を担保する。クライアント自体は境界を持たない。
 *
 * DB アクセスには絶対に使わない (DB は必ず lib/db の withTenant 経由)。
 * 認証ブートストラップ専用の RLS バイパス DB クライアントとも役割が異なる。
 *
 * モジュールスコープで 1 インスタンスをキャッシュする (毎回 createClient しない)。
 */
let cached: SupabaseClient | null = null;

export function getStorageClient(): SupabaseClient {
  if (cached) return cached;
  cached = createClient(
    supabasePublicConfig.url(),
    supabaseServerConfig.serviceRoleKey(),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
  return cached;
}
