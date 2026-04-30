# 寺務台帳 (Jimu-Daichou) — Claude Code プロジェクト規約

このファイルは Claude Code が毎セッション自動で読み込む、本プロジェクトの最上位ガイドラインです。実装判断で迷ったら、まずここに戻ってください。

---

## 1. プロジェクトの目的と理想像

「寺務台帳」は、お寺と檀信徒の関係を **100 年先まで** つなぐための SaaS です。単なる檀家管理ソフトではなく「檀信徒カルテ」として、お寺の運営を根本から支援します。

### 目指す 3 つの姿（実装判断の北極星）

1. **「記憶」を「記録」に変え、信頼を未来へつなぐ運営**
   - 住職・寺族の頭の中にある属人的な記憶を、組織の共有資産（記録）へ。
   - 代替わり・担当変更があっても、これまでの歩みを損なわず信頼を継続。

2. **「事務」を効率化し、「法務と対話」に専念できる運営**
   - 年忌表・宛名書き等の膨大な事務を自動化し、物理的・心理的な余裕を生む。
   - その余白を法務（儀礼）と、檀信徒一人ひとりとの対話に充てる。

3. **「すぐ見つかり、気づき、思いやる」伴走型の運営**
   - 電話が鳴った瞬間に相手の家族状況・過去の履歴を把握できるカルテ。
   - 「相手が今何を必要としているか」に先回りして気づける、現代の寺院運営。

> **一言で**: デジタルという道具を使いこなすことで、アナログな人間関係をより深く、温かいものにする。

実装で「これはどちらを選ぶべきか」と迷ったら、上記 3 原則に沿う方を選んでください。

---

## 2. ドメイン用語集（必読）

本プロジェクトは仏教・寺院運営の専門用語を扱います。**英語命名・日本語表示は必ずこの対応表に従ってください**。詳細は `docs/domain/ubiquitous-language.md` を参照。

| 日本語 | English (コード上) | 意味 |
| :--- | :--- | :--- |
| 檀家 / 檀信徒 | `Parishioner` | お寺を支援する家/人。本プロダクトでは「檀信徒」を標準呼称とする |
| 施主 | `Householder` | 世帯の代表者。法要を主催する人 |
| 世帯 | `Household` | 施主を中心とした家族単位。カルテの基本単位 |
| 家族構成員 | `Person` | 世帯に属する個人（存命・故人を問わない） |
| 過去帳 | `DeathLedger` | 故人の記録簿。**絶対に物理削除してはならない** |
| 過去帳エントリ | `DeathLedgerEntry` | 過去帳内の 1 名分の記録 |
| 戒名 | `KaimyoName` (posthumous Buddhist name) | 故人に授けられる仏弟子としての名 |
| 俗名 | `SecularName` | 生前の氏名 |
| 没年月日 | `DateOfDeath` | 亡くなった日。和暦・西暦両方を保持 |
| 行年 | `AgeAtDeath` | 亡くなった時の年齢 |
| 続柄 | `FamilyRelation` | 世帯主との関係（父・母・配偶者・長男 等） |
| 年忌 | `MemorialAnniversary` | 故人の命日から数えた記念年（1, 3, 7, 13, 17, 23, 27, 33, 37, 50 回忌） |
| 法要 | `MemorialService` | 故人の供養のための儀式 |
| 塔婆 | `Toba` | 法要時に立てる木製の供養塔 |
| 御布施 | `Offering` | 法要に対するお布施 |
| 護持会費 | `MaintenanceFee` | 檀信徒が毎年納める会費 |
| お墓 / 区画 | `GravePlot` | 墓地内の 1 区画 |
| 埋葬 | `Burial` | お墓への納骨 |
| 案内状 | `NoticeLetter` | 法要等の案内 |
| 年忌表 | `AnniversarySchedule` | 対象年に年忌を迎える故人一覧 |

---

## 3. 技術スタック（採用理由の要点）

| レイヤ | 採用 |
| :--- | :--- |
| 言語 | TypeScript |
| Web フレームワーク | Next.js 15 (App Router) |
| UI | React + Tailwind CSS + shadcn/ui |
| DB | PostgreSQL (Phase1: Supabase / Phase3: AWS RDS or Cloud SQL) |
| ORM | Prisma |
| 認証 | Supabase Auth + Google OAuth |
| ストレージ | Supabase Storage (S3 互換) |
| マルチテナント | 共有 DB + `tenant_id` + Row Level Security (RLS) |
| カレンダー連携 | Google Calendar API |
| 帳票 PDF | `@react-pdf/renderer` |
| モバイル (Phase3) | Expo (React Native) |
| リポジトリ | モノレポ (pnpm workspaces + Turborepo) |
| ホスティング Phase1 | Vercel (Web) + Supabase (DB/Auth/Storage) |

詳細と採用理由は `docs/adr/0001-tech-stack.md` を参照。

---

## 4. アーキテクチャ原則（絶対順守）

### 4.1 マルチテナント分離（Day 1 から）
- **全テーブルに `tenantId` カラムを必須化**。例外なし。
- **PostgreSQL RLS (Row Level Security) を常に ON**。セッション変数 `app.current_tenant_id` でフィルタ。
- **アプリ層でも二重チェック**: Prisma クエリは必ず `withTenant()` ラッパー経由で発行。
- **違反する PR は絶対にマージしない**。
- 詳細: `docs/architecture/multi-tenancy.md`

### 4.2 個人情報・宗教情報の取扱い
- **個人情報 (氏名・住所・電話・メール) はログに出力しない**。ログでは必ずマスク or ID のみ。
- **過去帳データは論理削除のみ。物理削除 (`DELETE`) は禁止**。宗教的・歴史的価値のため、どのような事情でも物理削除は認めない。
- **檀信徒情報は最小権限の原則**: 未ログインで取得できる情報はゼロ。
- 詳細: `docs/architecture/security-privacy.md`

### 4.3 日時・暦
- **タイムゾーンは `Asia/Tokyo` 固定**。UTC 保存・JST 表示ではなく JST 保存。
- **没年月日・命日は和暦 (`wareki`) と西暦 (`seireki`) を両方保持**。表示切替のため。
- **年忌計算は「命日」起点**。計算ロジックは `lib/nenki/` に集約し、必ず共通関数を呼ぶ（インライン計算禁止）。

### 4.4 命名・言語
- **変数・関数・型・ファイル名は英語**。ドメイン用語は §2 の対応表に従う。
- **UI 文言・コメント・コミットメッセージは日本語 OK**。
- **お寺向け UI なので、画面上の言葉は丁寧語・伝統的な寺院用語を優先**（例: "削除" より "除外" や "閉じる" を検討）。

---

## 5. ディレクトリ規約

```
寺務Harness/
├── CLAUDE.md                # このファイル
├── README.md
├── docs/                    # 設計・ドメイン・アーキテクチャ文書
│   ├── requirements/        # 要件定義書
│   ├── domain/              # ドメイン用語・年忌・和暦ルール
│   ├── architecture/        # マルチテナント・セキュリティ・データモデル
│   └── adr/                 # Architecture Decision Records
├── apps/
│   └── web/                 # Next.js 本体 (Phase1 はこれのみ)
│       └── src/
│           ├── app/         # Next.js App Router
│           │   ├── (auth)/  # ログイン・OAuth
│           │   └── (main)/  # ログイン後メイン
│           │       ├── dashboard/
│           │       ├── danshintoto/    # 檀信徒カルテ
│           │       ├── kakochou/       # 過去帳
│           │       ├── houyou/         # 法要・行事
│           │       ├── kukaku/         # 区画管理
│           │       ├── kaikei/         # 会計
│           │       └── settings/
│           ├── components/  # 汎用 UI
│           ├── features/    # ドメイン別 UI + Server Actions
│           └── lib/
│               ├── auth/    # セッション・テナント解決
│               ├── db/      # Prisma ラッパー (withTenant)
│               ├── google/  # Google Calendar API
│               ├── pdf/     # 帳票生成
│               ├── wareki/  # 和暦⇔西暦変換
│               ├── nenki/   # 年忌計算
│               └── search/  # 名前かな・電話番号検索
├── prisma/                  # スキーマ・マイグレーション
└── scripts/                 # 運用スクリプト (過去帳インポート等)
```

**新しいドメインロジックを書くときの決まり**:
- UI コンポーネント: `apps/web/src/features/<domain>/`
- 共通 UI: `apps/web/src/components/`
- 純粋ロジック (年忌計算・和暦変換等): `apps/web/src/lib/<topic>/`

---

## 6. コーディング規約

- **Server Actions でのテナント検証は `withTenant()` ラッパー必須**（未実装の場合は `lib/db/` で最初に整備する）。
- **DB アクセスは Prisma 経由のみ**。生 SQL は RLS の挙動確認済みの場合のみ許可。
- **`any` / `@ts-ignore` の使用禁止**。やむを得ない場合は `// TODO(型安全化):` コメントで理由を明記し、Issue 化。
- **`console.log` を本番コードに残さない**。調査用は `debug` パッケージか構造化ロガー経由。
- **コミットメッセージは Conventional Commits 風**: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:` + 日本語要約 OK。
  - 例: `feat(kakochou): 過去帳エントリ登録フォームを追加`
- **テストは主要ロジックに必須**: 特に `lib/nenki/`, `lib/wareki/`, マルチテナント境界。

---

## 7. 禁止事項（してはいけないこと）

以下の操作・コードは **絶対に NG** です。Claude Code もこれを破る提案をしてはいけません。

- ❌ `tenantId` 条件を含まない DB クエリ
- ❌ RLS ポリシーの無効化 (`DISABLE ROW LEVEL SECURITY`)
- ❌ 個人情報 (氏名・住所・電話・メール) を含むログ出力
- ❌ 過去帳の物理削除 (`DELETE FROM death_ledger_entries` 等)
- ❌ `console.log` を本番コードに残すこと
- ❌ `any` / `@ts-ignore` のカジュアル使用
- ❌ 過去帳・檀信徒データの公開リポジトリへの混入（`.env`、ダンプファイル、スクリーンショット含む）
- ❌ マイグレーションなしのスキーマ直変更

### 違反の予防

以下の静的検査を **Server Actions / Prisma スキーマ / adminPrisma 使用箇所の監査** に使える。機能実装の節目で必ず走らせる。

- `pnpm tenant-check` — 3 チェック (Server Action の `withTenant` カバレッジ / `adminPrisma` 許可リスト / 全モデルの `tenantId + @@index`) を grep ベースで実行
- Claude Code セッション内では **`/tenant-check`** スラッシュコマンドで同じ検査を走らせ、違反があれば Claude が該当ファイルを読んで修正方針を提示する

実装 / マイグレーション / PR 前のいずれかで 1 回以上走らせるのが推奨。違反ゼロ (`✅ テナント境界違反なし`) を正常状態として維持すること。

---

## 8. 開発フロー

```bash
# 初回セットアップ
pnpm install
cp .env.example .env          # 値を埋める
pnpm db:migrate               # マイグレーション適用
pnpm db:seed                  # 初期データ投入 (自寺のテナント 1 行)

# 開発
pnpm dev                      # apps/web を起動 (http://localhost:3104)

# 品質チェック (PR 前必須)
pnpm lint
pnpm typecheck
pnpm test

# マイグレーション追加
pnpm db:migrate:dev --name <変更内容>
```

---

## 9. Phase ロードマップ

- **Phase 1 (自寺のみ運用)** ← 今ここ
  - 檀信徒カルテ / 過去帳 / 法要 / 区画 / 会計 の MVP
  - Google カレンダー連携
  - 年忌表・案内状 PDF 生成
  - Supabase + Vercel で運用

- **Phase 2 (他寺院への SaaS 提供開始)**
  - テナント招待・切替 UI
  - 課金（Stripe 等）
  - 管理者ダッシュボード
  - セキュリティ監査・バックアップ強化

- **Phase 3 (モバイル展開・インフラ成熟)**
  - Expo (React Native) モバイルアプリ
  - `packages/types` `packages/api-client` を切り出し
  - AWS (ECS + RDS + S3) or GCP (Cloud Run + Cloud SQL + GCS) へ段階移行

---

## 10. 作業ログ (worklog) の運用

`docs/worklog/YYYY-MM-DD.md` に、開発セッションごとのメモを残す。**Claude は節目で能動的に今日のファイルを更新すること**。詳細・テンプレートは `docs/worklog/README.md`。

- **更新タイミング**: マイグレーション完了時 / 機能実装完了時 / 大きな判断をしたとき / ユーザーが「今日はここまで」等で区切ったとき
- **必ず書くこと**: 「今日やったこと」「決めたこと・気づき」「次回やること」「未解決・保留事項」
- `.claude/settings.json` の SessionStart フックにより、次回セッション開始時に最新ログが自動でコンテキストに注入される → 続きから迷子にならずに再開できる

---

## 11. 参考ドキュメント

- 要件定義: `docs/requirements/寺務台帳_機能要件定義書.md`
- ドメイン用語: `docs/domain/ubiquitous-language.md`
- 年忌計算ルール: `docs/domain/nenki-calculation.md`
- 和暦/西暦変換: `docs/domain/wareki-seireki.md`
- マルチテナント方針: `docs/architecture/multi-tenancy.md`
- セキュリティ・プライバシー: `docs/architecture/security-privacy.md`
- データモデル: `docs/architecture/data-model.md`
- 技術選定の経緯: `docs/adr/0001-tech-stack.md`
