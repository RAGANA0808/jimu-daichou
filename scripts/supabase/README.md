# Supabase 運用スクリプト

Supabase Dashboard の SQL Editor で実行する一回限りの運用 SQL を置く場所。
Prisma マイグレーションに載せられないもの (ロール作成、DB 全体設定など) のみ。

## スクリプト一覧

| ファイル | 目的 | 実行タイミング |
| :--- | :--- | :--- |
| `create-app-role.sql` | アプリ専用の NOBYPASSRLS ロール `jimu_app` を作成 | 初回セットアップ時 1 回のみ |

## 実行フロー (create-app-role.sql)

1. スクリプトを開き `<REPLACE_WITH_STRONG_PASSWORD>` を強力なパスワードに置換
   (保存先: 1Password 等のパスワードマネージャ)
2. Supabase Dashboard → SQL Editor に貼り付けて実行
3. リポジトリルートの `.env` の `DATABASE_URL` を更新
   - 変更前 (例): `postgresql://postgres.xxxxxxx:PASSWORD@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres`
   - 変更後: `postgresql://jimu_app.xxxxxxx:NEW_PASSWORD@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres`
   - `DIRECT_URL` は **変更しない** (postgres のまま維持 — マイグレーション実行に必要)
4. 検証:
   ```bash
   pnpm --filter @jimu-daichou/web test:integration
   ```
   5/5 緑になれば RLS が正しく効いている。
