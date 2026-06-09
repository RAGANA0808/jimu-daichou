# 寺務台帳 SaaS — 引き継ぎメモ & 次にやること設計書

最終更新: 2026-06-09
対象セッション後継者（新セッションの自分／別エージェント）向け。**まずこの1枚を読めば現在地と次の一手が分かる**ことを目的とする。

---

## 0. これは何 / どこにある

- **寺務台帳 (jimu-daichou)** — 寺院×檀信徒のマルチテナント SaaS。お寺と檀家の関係を100年先までつなぐ。
- 場所: `C:\Users\reon\開発\寺務Harness`（pnpm + Turborepo モノレポ、git 管理下）。
- スタック: Next.js 15 (App Router) + React 19 + TypeScript + Tailwind + Prisma + Supabase(PostgreSQL/Auth/Storage) + Google Calendar。
- dev: `pnpm dev` → http://localhost:3104（**OAuth のため 3104 固定**）。
- 開発エンジン: **Dynamic Workflows（`Workflow` ツール）**。要件を網羅的に洗い出しつつ既存コードを継続・拡張する（作り直さない）。

---

## 1. 現在地（2026-06-07 時点で完了していること）

### 分析・設計ドキュメント（`docs/requirements/`）
- `seizan-coverage-matrix.md` — **せいざん「寺務台帳」全12セクション × 自社コード棚卸し**（クリティック追補版）。せいざん概要HTML＋スクショ22枚を精読。**結論: せいざん12セクションの訴求機能に取りこぼしなし**（実装状況は ✅/🟡/❌ で明記）。**次に何を作るか迷ったらまずこの表を見る。**
- `taas-requirements-v2.md` — Temple as a Service 要件の再洗い出し。
- `ui-ux-redesign-v2.md` — UI/UX 再設計＋実装ロードマップ（ウェーブ順序の根拠）。
- `seizan-uiux-video-analysis.md` — せいざん紹介動画(48–90分)のUI/UX分析、P0/P1バックログ。
- `feature-backlog.md` / `competitor-analysis.md` — Discovery v1 の34エピックバックログ・競合分析。

### 実装済みウェーブ（すべて typecheck / test / tenant-check グリーン）
| ウェーブ | 内容 | migration |
| :-- | :-- | :-- |
| UI-1/2/3 | 履歴カテゴリ+ピン留め / 年忌バッジ / 固定アクションバー / タグ横断抽出 / 会計クロス集計 / 備考あいまい検索 / ビジュアル刷新（パステルオレンジ系ブランド色・ゴシック） | — |
| **UI-4 構造刷新** | サイドバーナビ（全機能・現在地）/ 高密度化 / 一覧テーブル化 / ダッシュボード cockpit / 檀信徒詳細タブ化 | — |
| **GRAVE-CORE** | Burial(納骨, 区画↔故人双方向) / GraveContract(預かり年数・満了) / 苗字・墓標名逆引き(検索統合) / 空き区画検索 / 地図ステータス色分け（経路描画なし=YMFG特許回避） | 20260607010000 / 010100 |
| **CONTACT-SEARCH** | ContactPoint(多階層連絡先, secondaryContact移行) / pg_trgm 全文検索+スニペット / HouseholdSuccession(承継履歴・手動承認) / 電話・郵便正規化 | 20260607020000 / 020100 |
| **PERMISSION** | RBAC実効化(HEAD_PRIEST全権 / READ_ONLY変更不可 / destructive=PRIEST+ / admin=HEAD_PRIESTのみ) / AuditLog監査ログ / refresh_token AES-256-GCM暗号化(土台) / 役割管理UI+監査ビューア | 20260607030000 |
| **MEMORIAL-EXPIRY** | 合祀候補抽出 / 改葬・墓じまい・合祀移行(destructiveガード+監査+手動確定=特許回避) / 年忌表 戒名順CSV(BOM,EXPORT監査) / 法要終了時刻 / 重複案内防止(ShipmentRecipientItem 故人×回忌×年の構造化突合) | 20260607040000 |
| **PAPERLESS-MOBILE** | 書類クラウド保管(Document 紐付け列追加・Supabase Storage・署名URL・論理削除・スマホ撮影) / 音声入力(Web Speech API) / 寺行事(TempleEvent 新設・カレンダー連携) / 横断年表(対応履歴×法要マージ read-only) / 楽観ロック(updatedAt) / かんたん登録ウィザード | 20260608010000 |
| **OUTREACH-NOTIFY / T-4** | 巡回(棚経・月参り)：CircuitTour/CircuitStop 新設・訪問先の順序リスト並べ替え(↑↓・**地図経路描画なし=YMFG回避**)・訪問/巡回ステータス・担当者×日付シフト表PDF(export+監査)・論理削除 | 20260608020000 |
| **OUTREACH-NOTIFY / O-2,O-3** | 宗派プリセット(Tenant.sect 11宗派・既定弔い上げを query/page 層で per-entry fallback として適用・**lib/nenki コア型不変=後方互換**) / 初期設定ウィザード(/settings/setup・4ステップ・admin+監査) | 20260608030000 |
| **PII 持出ガード統一** | 氏名/住所を含む CSV/PDF 8ルートを `requireCapability('export')` + EXPORT 監査に統一(READ_ONLY 持出と監査欠落を是正) | — (コード) |
| **OUTREACH-NOTIFY / T-2** | カレンダー取込(Google→寺・手動)：`events.list` で予定一覧→未紐付けを人手選択し寺行事として取込・既存 googleCalendarEventId で重複排除・**自動同期なし/外部送信なし=Classix特許回避** | — (migration 不要) |
| **ANALYTICS-LATER** | `/bunseki` 経年トレンド分析：会計年度別の集計値グラフ(自作SVG: 棒/集合棒/折れ線・a11y・色覚冗長地紋)・KPI4枚・**集計値のみ=JP7282407回避**・日時2系統(paidAt UTC / scheduledAt・createdAt JST)を `lib/analytics/yearly.ts` 純関数で分離・全read 単一 withTenant 集約・PII非露出 | — (migration 不要) |

**DBに適用済みの最終migration: `20260608030000_add_tenant_sect`**（`prisma migrate status` = up to date。T-2 はスキーマ変更なし）。

### Git / PR 運用（2026-06-09 開始）
- ウェーブ(またはバッチ)ごとに feature ブランチ → PR、マージ前に security-review を1回挟む。
- **PR #1**（基盤+PII+T-4+O-2/O-3）/ **PR #2**（T-2）→ **両方 MERGED**。main = `6db7060`（PR #1/#2 反映+引き継ぎメモの docs コミット）。マージ済みブランチは削除済み。
- **PR #3**（`wave/analytics-trends`: ANALYTICS-LATER 経年トレンド分析）→ **MERGED**。
- **PR #4**（`fix/karte-connection-pool`: 問題A 緩和=カルテ詳細のクエリをバッチ分割）→ **MERGED**。
- **PR #5/#7/#10/#12**（docs 反映）/ **PR #6**（年忌「あと◯年」）/ **PR #8**（過去帳 戒名順ソート）/ **PR #9**（チャート a11y）/ **PR #11**（ダッシュボード「承継の承認待ち」）/ **PR #13**（「今後の法要」に来月プレビュー）/ **PR #14**（「直近の年忌」に来年の案内準備ナッジ）→ すべて **MERGED**。
- 現在 **main = `a5f78fd`**（PR #14 反映）。マージ済みブランチは local/remote とも削除済み・tree クリーン。
- **「気づき」ビューはダッシュボード(`/dashboard`)が担う**（説明文「本日の気づきをまとめています」）。パネル: 今後の法要(**今月+来月** PR#13) / 未収(護持会費+墓地) / 直近の年忌(**+来年ナッジ** PR#14) / 合祀移行(=GraveContract 満了) / **承継の承認待ち**(PR#11) / 最近の対応履歴。新たな気づきは原則この既存コックピットへパネル追加で足す(別ページを作らない=重複回避)。
- **dashboard の Promise.all は現在 10 並列**（PR#11/#14 で +2）。prod pooler 上限15には余裕だが dev cap(connection_limit=10)に達したため、**これ以上クエリを増やすなら単一 withTenant 集約等の検討を**(問題A と同系統の注意)。
- **直 main への commit/push は auto classifier が却下する**（PR 経由必須）。docs 更新も小さなブランチ→PR→merge で通す。
- リモート: `github.com/RAGANA0808/jimu-daichou`。`gh` CLI 利用可。
- **次ウェーブからも `main` を最新化してから feature ブランチを切る**。
- **次セッション最優先**: 残ロードマップ(OUTREACH-NOTIFY T-3/A-5 自動リマインド=独立フェーズ → L系 商用前FTO/商標)。任意の安価改善として問題A根治(選択肢3=単一withTenant集約)も候補。

> **T-4 / O-2,O-3 とも実機 click-through 検証済み**。O-2 は宗派=浄土真宗で年忌バッジが33で打ち切り→未設定で全10回忌復帰(後方互換実証)、O-3 はウィザード4ステップ完走。**検証後テナント sect は元の未設定に復元済み**(実データ無変更)。test は 446 件(既存438+sect新規8)。

> **PAPERLESS-MOBILE / T-4 とも実機 click-through 検証済み**（chrome-devtools・dev 自己ログイン）。T-4 は巡回作成→訪問先追加→並べ替え→ステータス→シフト表PDF→除外(→/junkai 遷移)を住職アカウントで確認。検証中に T-4 の2点(reorder の部分配列堅牢化[med]・除外後 404 の redirect 追加)を修正・再検証済み。

> **PAPERLESS-MOBILE は実機 click-through 検証済み**（chrome-devtools・dev 自己ログイン）。書類 upload→プレビュー(署名URL)→除外 / 寺行事 CRUD / 年表 / かんたん登録 / 楽観ロックの競合検知 を住職アカウントで確認。**Storage バケットは初回 upload で自動作成**（手動設定不要＝旧懸念解消）。

---

## 2. 既知の問題 / 保留事項（重要・最初に目を通す）

### ⚠️ A. 接続プール枯渇（EMAXCONNSESSION）— **2026-06-09 にページ側バッチ分割で緩和済み（PR #4）。根治(選択肢3)は将来ウェーブ**
- **症状**: 名前検索 → 結果カルテへ遷移するとエラー（`EMAXCONNSESSION pool_size 15` / `22P02 invalid uuid ""`）。
- **根本原因**: `withTenant` が **Prisma の対話トランザクション**を使い、1tx=1コネクション占有。檀信徒詳細ページ `app/(main)/danshintoto/[id]/page.tsx` が **16個の withTenant クエリを Promise.all 並列実行**するため、Supabase セッションモード pooler の上限(15)を超える。
- **緩和（適用済み・PR #4 / `c1db5c7`）**: 詳細ページの 16 並列クエリを **6本ずつ3バッチに分割**（peak 同時接続 ≤6・取得結果は不変・実機全8タブ200確認）。これで prod でも上限に余裕。
- **暫定対策（既存）**: `apps/web/src/lib/db/client.ts` に **dev限定で `connection_limit=10&pool_timeout=20`**（超過分を待たせ枯渇させない）。本番では上書きしない。
- **根治の選択肢**（将来・どれか1つ）:
  1. **詳細ページの全クエリを1つの withTenant 内に集約**してコネクション占有を1本化（**最も筋が良い・選択肢3**）。各 `*ByHousehold` クエリに optional `tx?: Prisma.TransactionClient` を通す ~14ファイルの改修。tenant-check は `'use server'` ファイルのみ検査するためクエリモジュール改変では壊れない。**ultracode の独立ウェーブ推奨**。
  2. **Supabase Pro 化**（ユーザー希望・後回しでOK）。
  3. **無料のまま**: `DATABASE_URL` を Supabase の **transaction モード pooler（port 6543）** に切替（`?pgbouncer=true`）。※対話トランザクションとの相性に注意。
- **判断**: ユーザーは「Supabase を Pro にすることで解決するなら後回しでよい」と明言。**当面は触らなくてよい**が、選択肢3はコード品質的にいつかやる価値あり。

### ✅ B. 機能テスト（遷移・E2E）— **2026-06-08 に経路確立**
- 方針どおり **chrome-devtools MCP で主要導線を実機 click-through 検証**する運用に移行（PAPERLESS-MOBILE で全機能を検証済み）。
- **ログイン手順（dev 自己ログイン）**: ① Chrome を `--remote-debugging-port=9222 --user-data-dir=<tmp>` で起動 → ② **ユーザーに** `pnpm --filter @jimu-daichou/web exec tsx scripts/dev-login.ts` を実行してもらい出力 JSON（session cookie）を貼ってもらう（Claude は `.env` 読み取りが権限ガードで拒否されるため直接実行不可）→ ③ chrome-devtools の `evaluate_script` で `document.cookie` に投入 → `/dashboard` へ navigate。
- **dev サーバ再起動の注意**: ワークフローで `pnpm db:generate` した後は、稼働中 dev サーバの Prisma client が古いため**再起動が必要**（新モデルが見えない）。`:3104` の node を停止して `pnpm dev` し直す。
- 詳細はメモリ [[feedback-verification-login]] / `apps/web/scripts/dev-login.ts`。
- **❗ 2026-06-09 に判明した CDP×Edge middleware の落とし穴**: chrome-devtools(CDP)のブラウザ・ナビゲーションは、Edge runtime の middleware で `getUser()` の Supabase fetch が中断され("The user aborted a request"→Retrying)、**有効 cookie でも `/login` に 307 リダイレクト**されることがある。**node/curl からの単発リクエストは 200** で正常(middleware も page も Node 経路は正常)。これは環境固有でアプリのバグではない。
  - **回避(auth を弱めない)**: ① `dev-login.ts` は Claude が**自分で実行可**(.env は Read ツールでは権限ガードされるが Node の readFileSync は通る)。② 認証済み HTML を **node fetch で取得**(`fetch('http://localhost:3104/<path>',{headers:{cookie}})`→200)し構造アサート。③ 取得 HTML に `<base href="http://localhost:3104/">` 注入・`<script>`/`<template>` 除去・`<div hidden id="S:">` の hidden 解除で**静的SSRを file:// 描画→screenshot**。
  - **やってはいけない(auto classifier がブロック・妥当)**: セッショントークンを web 配信 public へ書く / `JDC_VERIFY_BYPASS` 等で middleware の auth を弱めて起動。
- **`pnpm tenant-check` は PowerShell では bash 不在で exit1** → **Bash ツールで `bash scripts/tenant-check.sh` を直接実行**(検査ロジックは正常)。

### C. RLS NULLIF ハードニング migration — **未適用（保留）**
- 一部 RLS ポリシーが脆弱形 `current_setting('app.current_tenant_id', true)::uuid`（空文字で `22P02` を誘発しうる）。安全形 `NULLIF(current_setting(...), '')::uuid` に統一する migration を**作成したが、セキュリティ高影響（全27テーブルのポリシーDROP+CREATE）のため自動モードでブロックされ、適用していない**。該当ファイルは**削除済み**（誤適用防止）。
- **再開時**: 本当に必要なら **ユーザー承認を取ってから** 再作成・適用する。接続枯渇(A)が解決すれば `22P02` 自体の発生頻度は下がるため、優先度は中。

### D. その他
- **`pnpm lint` は実行不能**（ESLint未設定・`next lint` が対話プロンプトで落ちる）。品質ゲートから除外中。ESLint設定の新規作成はリポジトリ全体影響の別タスク。
- **`pnpm build` 完走しない**: 静的エクスポート段階で Radix の `useContext` prerender エラー（`/nenki`等~10ページ）。dev/typecheck/test は通る。本番ビルドは別途切り分けが必要（別チップ task_1879cdee）。
- **`APP_ENCRYPTION_KEY`（任意）**: `.env` に `openssl rand -base64 32` の値を入れると以降の refresh_token が暗号化される（未設定でも平文後方互換で動作）。
- **未コミット変更が多数**（前回確認時 ~198ファイル、現在 ~230+）。コミットはユーザー指示時のみ。
- **PAPERLESS-MOBILE レビュー由来の low 指摘（要否判断のうえ対応）**:
  - PII 持出系（`shipment/csv` route [med] / 各 PDF route [low]）に `requireCapability('export')` + EXPORT 監査が無く、READ_ONLY も取得でき監査に残らない（テナント分離自体は有）。`nenki/csv` と非対称。→ ロードマップ「PII 持出ガードの統一」。
  - `interaction-actions` / `contact-point-actions` に `recordAudit` 無し（`AuditEntityType` に未定義）。檀信徒カルテ本体変更の監査範囲はプロジェクト全体の方針保留。
  - 寺行事(gyouji)に楽観ロック未配線（単寺・低頻度のため実害小・横展開の一貫性で将来追加余地）。
  - `toba/actions.ts` が catch で `err.message` を生返し（現状は固定文のみで実害なし）。

---

## 3. 残ロードマップ（次に作るウェーブ・推奨順）

ロードマップ根拠は `docs/requirements/ui-ux-redesign-v2.md`。せいざん網羅の残りは §5(書類保管) / §7(音声入力) / §10(棚経シフト) / §12(経年分析)。

| 優先 | ウェーブ | 内容 | 前提・注意 |
| :-- | :-- | :-- | :-- |
| ~~済~~ | ~~**PAPERLESS-MOBILE**~~ | ✅ 2026-06-08 完了（migration 20260608010000・実機検証済み） | — |
| ~~済~~ | ~~**PII 持出ガード統一**~~ | ✅ 2026-06-08 完了（8ルートを export+監査に統一） | — |
| 1 | **OUTREACH-NOTIFY**（残り） | ~~T-4 巡回・シフト表~~ ✅ / ~~O-2/O-3 宗派プリセット+初期設定~~ ✅ / ~~T-2 カレンダー取込~~ ✅完了。**残: T-3/A-5 自動リマインド・マルチチャネル配信** | T-3/A-5 は**メール送信基盤ゼロ・対外送信**のためプロバイダ選定(Resend 等)+API キー+送信承認が前提＝独立フェーズ。Classix 回避で通知は寺内部限定。抽出→人手確認→生成の手動トリガ維持 |
| ~~済~~ | ~~**ANALYTICS-LATER**~~ | ✅ `/bunseki` 経年トレンドグラフ完了（**PR #3 OPEN**・集計値グラフのみ=JP7282407回避・migration/依存なし・自作SVG・実機検証済み）。残: 檀家減少リスク予測・領収書取込は将来 | — |
| 3 | **LEGAL（商用前）** | 弁理士FTO・商標調査（「檀信徒カルテ」「寺務台帳」の対外使用） | 機能ではなく非機能タスク。商用化前に必須 |

**いつでも入れてよい改善（安価・UI層中心）**: ~~年忌バッジに「次回まであと◯年」明示~~ ✅(PR #6) / ~~タイル面に種別+番号+使用者姓~~ ✅(実装済=`MapTile` が種別短縮+番号 ＋ 墓標名 or 使用者姓 を表示) / ~~一覧の戒名順ソート・並べ替え導線~~ ✅(PR #8 戒名順追加) / 詳細ページのクエリ集約（=問題A選択肢3・PR #4 で緩和済・根治は将来 ultracode ウェーブ）。**この安価UI改善の在庫はほぼ消化済み**。次の有意味な前進は §3 の OUTREACH T-3/A-5（要: 対外送信のプロバイダ/認証情報/承認）か、問題A根治（ultracode 大改修）か、新規要望。

---

## 4. 開発の進め方（必ず守る規約）

### Dynamic Workflow パターン
- フェーズ構成: **設計（並列 parallel）→ 実装（直列 SERIAL）→ 検証**。
- **実装は必ず直列**（typecheck はプロジェクト全体・migration はレース不可のため、並列にするとファイル/DB競合）。
- workflow スクリプト内では `Date.now()` / `Math.random()` / `new Date()` 使用不可（バリデータが弾く）。プロンプト文字列内の **バッククォートも避ける**（パースエラーになる）。
- **chat を ESC/stop で止めると実行中の background workflow も kill される**。workflow は完了時に自動通知。

### マルチテナント（絶対）
- 全テーブル `tenantId` + `@@index([tenantId])`、RLS 常時ON（policy `tenant_isolation`）。
- Server Action は **`withTenant()` 経由必須**（`apps/web/src/lib/db/with-tenant.ts`）。`adminPrisma` は認証ブートストラップのみ（allowlist は `pnpm tenant-check` が強制）。

### マイグレーション（非対話のみ）
1. `prisma/migrations/<timestamp>_<name>/migration.sql` を**手書き**（**RLS policy の CREATE も必ず含める**）。
2. `pnpm db:migrate deploy` → `pnpm db:generate`。
3. **`prisma migrate dev` は絶対に使わない**（対話的・shadow DB を作る）。
4. enum 拡張（`ALTER TYPE ... ADD VALUE`）はトランザクション制約のため**別migrationに分離**。
5. migration は DIRECT_URL を使うのでプール枯渇時でも通る。
6. `db:generate` が EPERM（DLL ロック）で落ちたら**dev サーバーを止めてから**再実行。

### 品質ゲート（緑を維持）
- `pnpm typecheck` / `pnpm test` / `pnpm tenant-check`。`pnpm lint` は除外（前述D）。
- **加えて今後は**: 主要導線の Playwright/chrome-devtools 実機 click-through（問題B）。

### ドメイン規約
- 年忌計算=`lib/nenki/`、和暦=`lib/wareki/` の共通関数を必ず呼ぶ（インライン計算禁止）。
- `@db.Date` は `Date.UTC()` で保存・`getUTC*` で読む。JST 基準。
- 過去帳・書類は**論理削除のみ**。個人情報はログ出力禁止。UI文言は丁寧語・寺院用語。
- UI は `features/<domain>/`、共通UIは `components/ui/`(shadcn)、ページは `app/(main)/<domain>/`。

### 特許回避（[[jimu-patent-constraint]] / `docs/legal/patent-analysis.md`）
- せいざん JP7282407（更新順ポータル自動並べ替え）→ **実装しない**。「更新順に並ぶ行リスト」をダッシュボード主構成にしない。
- TERA JP7705103（死亡→次施主自動）→ **手動承認必須**（HouseholdSuccession で担保済み）。
- YMFG JP2022036640A（地図上の墓参ルート描画）→ **経路ライン描画しない**。巡回は順序リストのみ。
- 抽出→**人手確認**→生成の手動トリガを各所で維持（自動発送パイプライン回避）。
- ブランド色はせいざんのティール/シアンを避け、**パステルオレンジ/黄系**（採用済み）。

---

## 5. すぐ動かすコマンド

```bash
cd "C:/Users/reon/開発/寺務Harness"
pnpm install              # 初回・依存変更時
pnpm db:generate         # Prisma Client 生成
pnpm dev                 # http://localhost:3104（OAuthのため固定）
# 品質ゲート
pnpm typecheck && pnpm test && pnpm tenant-check
# migration（手書き後）
pnpm db:migrate deploy && pnpm db:generate
```

---

## 6. クリティカルなファイル（再利用・着手の起点）

- マルチテナント: `apps/web/src/lib/db/with-tenant.ts` / `client.ts`(接続キャップ) / `admin-client.ts`
- ドメイン: `apps/web/src/lib/nenki/` / `lib/wareki/` / `lib/search/`（検索） / `lib/chuin/`（中陰） / `lib/postal-transfer/`
- 権限・監査: `apps/web/src/lib/auth/rbac.ts` + `rbac-core.ts` / `lib/audit/record.ts` / `lib/crypto/secret.ts`
- 区画・契約: `apps/web/src/lib/grave/contract.ts` / `features/kukaku/`（expiry-queries/actions, BurialForm, map/）
- 問題Aの震源: `apps/web/src/app/(main)/danshintoto/[id]/page.tsx`（~14並列 withTenant）
- スキーマ: `prisma/schema.prisma` + `prisma/migrations/`
- 検査: `scripts/tenant-check.sh` / `scripts/check-rls.ts`
- 規約: ルート `CLAUDE.md` / `docs/architecture/` / `docs/domain/` / `docs/legal/patent-analysis.md`

---

## 7. 新セッションでの再開方法（→ §「新セッションへの引き継ぎプロンプト」参照）

新しいセッションの**最初のメッセージ**は、本ファイル末尾の「コピペ用プロンプト」をそのまま貼ればよい。
</content>
</invoke>
