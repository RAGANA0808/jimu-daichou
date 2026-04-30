import 'server-only';
import { google } from 'googleapis';
import { googleAuthConfig } from './env';

/**
 * OAuth 2.0 クライアントを生成する。
 * 環境変数に依存するので、呼び出しは Server Component / Route Handler / Server Action 内でのみ。
 */
export function createOAuthClient() {
  return new google.auth.OAuth2(
    googleAuthConfig.clientId(),
    googleAuthConfig.clientSecret(),
    googleAuthConfig.redirectUri(),
  );
}
