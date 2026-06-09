// dev 専用: click-through 検証のためのローカルログインヘルパー。
//
// マジックリンクのメール受信なしでセッション cookie を生成する。
//   1. service-role で admin.generateLink({type:'magiclink'}) → token_hash 取得
//   2. アプリと同じ @supabase/ssr の server client で verifyOtp(token_hash)
//      → setAll に渡る cookie 群を捕捉 (= アプリが読む形式そのもの)
//   3. document.cookie で投入できる JS スニペット + JSON を出力
//
// 実行 (リポジトリ root から):
//   pnpm --filter @jimu-daichou/web exec tsx scripts/dev-login.ts [email]
// もしくは apps/web で:
//   pnpm exec tsx scripts/dev-login.ts [email]
//
// 既定 email は芳全寺 住職アカウント。Supabase Auth に存在するユーザーであること。
// 【dev 限定】本番では使わない。出力 cookie はローカルブラウザのセッションを確立するだけ。

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

type CapturedCookie = {
  name: string;
  value: string;
  options?: { path?: string; maxAge?: number; sameSite?: string };
};

// dotenv に依存せず .env を直接読み込む (cwd と repo root の両方を探索)。
function loadDotEnv(): void {
  const candidates = [
    '.env.local',
    '.env',
    '../../.env.local',
    '../../.env',
  ];
  for (const file of candidates) {
    try {
      const text = readFileSync(resolve(process.cwd(), file), 'utf8');
      for (const lineRaw of text.split(/\r?\n/)) {
        const line = lineRaw.trim();
        if (!line || line.startsWith('#')) continue;
        const eq = line.indexOf('=');
        if (eq === -1) continue;
        const key = line.slice(0, eq).trim();
        let val = line.slice(eq + 1).trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        if (!(key in process.env)) process.env[key] = val;
      }
    } catch {
      // ファイルが無ければスキップ
    }
  }
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.length === 0) {
    throw new Error(`環境変数 ${name} が未設定です (.env を確認)。`);
  }
  return v;
}

async function main() {
  loadDotEnv();

  const email = (process.argv[2] ?? 'alwayshappys2.forever@gmail.com')
    .trim()
    .toLowerCase();

  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const anon = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  const service = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  // 1) token_hash を生成 (メール送信なし)
  const admin = createClient(url, service, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  if (linkErr || !link?.properties?.hashed_token) {
    throw new Error(
      `generateLink 失敗: ${linkErr?.message ?? 'token_hash が空'} (email=${email})`,
    );
  }
  const tokenHash = link.properties.hashed_token;

  // 2) アプリと同型の cookie を捕捉
  const captured: CapturedCookie[] = [];
  const server = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return [];
      },
      setAll(cookiesToSet) {
        for (const c of cookiesToSet) {
          captured.push({
            name: c.name,
            value: c.value,
            options: c.options as CapturedCookie['options'],
          });
        }
      },
    },
  });

  // 型は magiclink を第一候補、ダメなら email でフォールバック
  let verifyErr: string | null = null;
  for (const t of ['magiclink', 'email'] as const) {
    captured.length = 0;
    const { error } = await server.auth.verifyOtp({
      type: t,
      token_hash: tokenHash,
    });
    if (!error && captured.length > 0) {
      verifyErr = null;
      break;
    }
    verifyErr = error?.message ?? '(cookie が捕捉できませんでした)';
  }
  if (verifyErr) {
    throw new Error(`verifyOtp 失敗: ${verifyErr}`);
  }

  // 3) document.cookie 用スニペット (secure は dev/http のため付けない)
  const setters = captured
    .map((c) => {
      const path = c.options?.path ?? '/';
      const maxAge = c.options?.maxAge ? `;max-age=${c.options.maxAge}` : '';
      return `document.cookie=${JSON.stringify(
        `${c.name}=${c.value};path=${path}${maxAge};samesite=lax`,
      )};`;
    })
    .join('\n');

  console.log('=== dev-login: 認証成功。以下を chrome-devtools で投入 ===');
  console.log(`// email=${email}  cookies=${captured.length}`);
  console.log(setters);
  console.log('=== その後 http://localhost:3104/dashboard へ navigate ===');
  console.log('---JSON---');
  console.log(JSON.stringify(captured));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
