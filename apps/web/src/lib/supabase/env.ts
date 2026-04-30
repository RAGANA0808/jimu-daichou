/**
 * Supabase 関連の必須環境変数を読み出すヘルパ。
 * 未設定時は起動直後に明示的にエラーにし、失敗を遅らせない。
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.length === 0) {
    throw new Error(
      `環境変数 ${name} が未設定です。.env を確認してください。`,
    );
  }
  return value;
}

/**
 * 公開可能な (ブラウザで読めてよい) 値。
 * Row Level Security + Supabase Auth のポリシーが機能する前提で公開できる。
 */
export const supabasePublicConfig = {
  url: () => requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
  anonKey: () => requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
} as const;

/**
 * サーバー専用の秘匿値。ブラウザに漏れてはならない。
 * アプリ本体では原則使わない (認証は anon キー + RLS で動く)。
 * 将来、管理者専用の API などで必要になった場合のみ使用する。
 */
export const supabaseServerConfig = {
  serviceRoleKey: () => requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
} as const;
