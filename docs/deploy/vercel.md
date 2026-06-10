# 本番デプロイ手順 (Vercel + Supabase)

Phase1 (自寺運用) を Vercel(Web) + Supabase(DB/Auth/Storage) で公開するための手順。
**本番ビルドは PR #18 以降 `pnpm build` exit 0 で通る**前提 (Next 15.5.19)。

> ⚠️ 実デプロイは Vercel/Google/Supabase の各アカウント操作 (外向き) を伴う。
> ここでは「何を・どこに設定するか」を漏れなく示す。値はダッシュボードから取得・設定し、
> リポジトリにはコミットしない。

---

## 1. 必要な環境変数

ローカルは `.env` (リポジトリ root・`.gitignore` 済み)、**本番は Vercel のプロジェクト環境変数**
(Production / Preview の両方) に同じキーを設定する。`NEXT_PUBLIC_` 付きはクライアントにも露出する。

| キー | 用途 | 取得元 | 秘匿 |
| :-- | :-- | :-- | :-- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase プロジェクト URL | Supabase > Settings > API | 公開可 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 匿名公開キー | 同上 | 公開可 |
| `SUPABASE_SERVICE_ROLE_KEY` | **RLS を bypass する強権**・サーバ専用 | 同上 | **厳秘** |
| `DATABASE_URL` | アプリ実行時の接続 (pooler 推奨) | Supabase > Settings > Database | **厳秘** |
| `DIRECT_URL` | マイグレーション用の直結 (port 5432) | 同上 | **厳秘** |
| `NEXT_PUBLIC_APP_URL` | OAuth リダイレクト・絶対URL生成。末尾スラッシュなし | 本番ドメイン `https://<domain>` | 公開可 |
| `GOOGLE_CLIENT_ID` | Google OAuth クライアント ID | Google Cloud Console | 公開可相当 |
| `GOOGLE_CLIENT_SECRET` | 同シークレット | 同上 | **厳秘** |
| `APP_ENCRYPTION_KEY` (任意) | Google refresh_token の AES-256-GCM 暗号化鍵 | `openssl rand -base64 32` | **厳秘** |

> **`NODE_ENV` は設定しないこと。** `next dev`=development / `next build`=production を
> ツールが決める。`.env` に `NODE_ENV=development` を置くと本番ビルドが壊れる
> (ローカルの build script は `cross-env NODE_ENV=production` で強制している)。

---

## 2. Vercel プロジェクト設定 (モノレポ)

1. **Import** リポジトリ `RAGANA0808/jimu-daichou`。
2. **Root Directory = `apps/web`** に設定 (モノレポのため必須)。
3. Framework Preset: **Next.js** (自動検出)。Node.js は 20 以上。
4. **Build Command (要オーバーライド)**:
   - 既定の package `build` は `dotenv -e ../../.env -- cross-env NODE_ENV=production next build` で、
     **Vercel には `../../.env` が存在しない**ため失敗する (env は Vercel 側で注入する)。
   - Vercel の Build Command を **`next build`** に上書きする (Vercel が NODE_ENV=production と
     環境変数を供給する)。Install Command は既定 (`pnpm install`) でよい。
5. 上記 1. の環境変数をすべて登録 (Production / Preview)。`NEXT_PUBLIC_APP_URL` は本番ドメイン。

---

## 3. Supabase 側

1. 本番 Supabase プロジェクトの **DB にマイグレーションを適用**:
   `DIRECT_URL` を本番に向けて `pnpm db:migrate deploy` → `pnpm db:generate`
   (手書きマイグレーションは RLS policy も含む。`prisma migrate dev` は使わない)。
2. **RLS が全テーブルで ON** であることを確認 (`scripts/check-rls.ts` / `pnpm tenant-check`)。
3. 初期テナント (自寺) の seed を投入 (`pnpm db:seed` 等・本番 DB に対して)。
4. **Auth > URL Configuration** の Redirect URLs に
   `${NEXT_PUBLIC_APP_URL}/api/auth/callback` (マジックリンク) を追加。
5. Storage バケットは初回 upload 時に自動作成される (手動設定不要)。

---

## 4. Google OAuth (カレンダー連携)

1. Google Cloud Console > Credentials の OAuth クライアントの
   **承認済みリダイレクト URI** に `${NEXT_PUBLIC_APP_URL}/api/google/auth/callback` を追加。
2. スコープは `calendar.events` (読取/書込) ＋ profile/email。

---

## 5. デプロイ後の確認

- `/login` でマジックリンクログイン → `/dashboard` 表示。
- 主要導線 (檀信徒カルテ / 過去帳 / 法要 / 区画 / 会計 / 分析) を click-through。
- 接続プール: 本番 pooler は session mode (上限15)。カルテ詳細・ダッシュボードは
  バッチ化で peak ≤6 (PR #4/#16) なので余裕があるが、負荷次第で Supabase Pro 化を検討。

---

## 既知の注意点

- **ビルドの NODE_ENV / .env**: 上記 1.・2.4 の通り。`pnpm build` がローカルで通っても
  Vercel では Build Command の上書きが必要。
- `pnpm lint` は PR #20 で品質ゲート化済み (`eslint . --max-warnings 0`)。CI に組み込み可。
- 接続枯渇の恒久対策 (単一 withTenant 集約) は未実施 (緩和済み・HANDOFF §2A 参照)。
