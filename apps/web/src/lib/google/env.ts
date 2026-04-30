/**
 * Google OAuth / Calendar API の設定値を環境変数から読み出すヘルパ。
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

export const googleAuthConfig = {
  clientId: () => requireEnv('GOOGLE_CLIENT_ID'),
  clientSecret: () => requireEnv('GOOGLE_CLIENT_SECRET'),
  redirectUri: () => {
    const appUrl = requireEnv('NEXT_PUBLIC_APP_URL').replace(/\/$/, '');
    return `${appUrl}/api/google/auth/callback`;
  },
} as const;

/** Google Calendar への書き込みに必要なスコープ + 連携アカウント識別用 */
export const GOOGLE_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
] as const;
