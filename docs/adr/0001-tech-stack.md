# ADR 0001: 技術スタックの選定

- **ステータス**: 採用
- **日付**: 2026-04-22
- **決定者**: プロジェクトオーナー（住職兼開発者）

## コンテキスト

「寺務台帳」を立ち上げるにあたり、以下の前提で技術スタックを決定する必要があった:

- 開発者は 1 人
- 将来的にモバイルアプリ (iOS/Android) で寺務を扱いたい
- Google カレンダー連携が必須
- 当面は自寺のみ運用、その後他寺院への SaaS 提供を想定
- 検討余力あり: Vercel/Supabase で始め、将来 AWS/GCP に移行
- 扱う情報は個人情報 + 要配慮個人情報 (宗教的帰属・故人情報)

## 決定

### 言語・フレームワーク
- **TypeScript**: Web / モバイル / サーバー間でドメイン型を共有。
- **Next.js 15 (App Router)**: Server Actions で 1 人開発でも CRUD が高速に書ける。React Server Components で初期表示・SEO が良好。将来 API 切り出しも可能。

### UI
- **React + Tailwind CSS + shadcn/ui**: ロックインがなく、和風テーマにカスタマイズしやすい。コンポーネントは自リポジトリ管理で長期メンテ可。

### データ層
- **PostgreSQL**: 世帯・故人・法要の関係性が強く RDB 向き。和暦/西暦両持ち、複雑な年忌クエリにも対応可。
- **Prisma**: スキーマ駆動・型安全・マイグレーション管理が明示的。過去帳のような長寿命データに向く。

### マルチテナント
- **共有 DB + tenant_id + Row Level Security (RLS)**: Day 1 から有効化する。自寺のみ運用中でもテナントを 1 行作って RLS の中で動かす。運用コスト最小・2 寺院目追加が容易。

### 認証
- **Supabase Auth + Google OAuth**: Google Calendar 連携のトークンがそのまま使える。Phase1 の工数を最小化。Phase2 で Auth.js (NextAuth) への移行も可能。

### ストレージ
- **Supabase Storage**: S3 互換で将来 AWS S3 に移行容易。

### カレンダー連携
- **Google Calendar API**: OAuth でユーザーの Google アカウントにイベント登録。寺族間のリアルタイム共有。

### 帳票 PDF
- **`@react-pdf/renderer`**: 宣言的に和文レイアウトを組める。年忌表・案内状・宛名ラベルに十分。

### リポジトリ構成
- **モノレポ (pnpm workspaces + Turborepo)**: Phase1 は `apps/web` だけ。Phase3 で `apps/mobile` (Expo) と `packages/types`, `packages/api-client` を追加。

### ホスティング

| フェーズ | 構成 |
| :--- | :--- |
| Phase 1 (自寺のみ) | **Vercel (Web) + Supabase (DB/Auth/Storage)** |
| Phase 2 (他寺院提供開始) | 同上 + Stripe (課金) + 監視 (Sentry 等) |
| Phase 3 (スケール) | **AWS (ECS + RDS + S3)** or **GCP (Cloud Run + Cloud SQL + GCS)** に移行検討。Postgres/S3 互換のため移行負荷は比較的軽い。 |

---

## 採用しなかった選択肢

### Laravel + Inertia/Vue
- 国内事例多数・帳票ライブラリ充実。
- **不採用理由**: TypeScript による型共有、将来のモバイル (React Native) との再利用が失われる。PHP 運用のインフラ選択肢が Vercel + Supabase の組合せと比べて初期立ち上げで重い。

### Rails + Hotwire
- CRUD 中心 SaaS で生産性が高い。
- **不採用理由**: 同上。TypeScript 型共有・モバイル再利用のメリットを失う。

### スキーマ分離マルチテナント
- **不採用理由**: 1 人運用でマイグレーションが N 倍になり事故リスク大。

### テナント毎 DB 分離
- **不採用理由**: 2〜3 寺院規模では過剰設計。運用コストが見合わない。

### NoSQL (Firestore 等)
- **不採用理由**: 過去帳・世帯・続柄・年忌の関係性が強く、RDB が圧倒的に向く。

---

## 結果

- MVP の立ち上がりが速い（Server Actions で CRUD を即実装可能）。
- Day 1 からマルチテナント + RLS を強制することで、他寺院展開の土台が整う。
- モバイル・インフラ移行・課金の各拡張点に明確な移行パスがある。

## リスクと対策

| リスク | 対策 |
| :--- | :--- |
| Supabase ロックイン | Postgres 互換 + S3 互換で組んでおり、移行経路あり。 |
| Next.js App Router の急速な進化 | メジャーアップデートは四半期に 1 度レビュー。 |
| RLS ポリシーのミス | `withTenant()` の二重防御 + CI でのポリシー存在チェック。 |
| モバイル対応の見送り | Phase3 まで待つ。型だけでも後日切り出し可能な構造にしておく。 |
