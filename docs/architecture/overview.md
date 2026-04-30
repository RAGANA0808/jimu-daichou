# アーキテクチャ概要

## 全体像

寺務台帳は **シングルページアプリ風の Next.js アプリ** をフロントとし、バックエンドは Next.js の Server Actions / Route Handlers で処理する「フルスタック Next.js」構成で始める。

```
┌────────────────────────────────────────────────┐
│  ブラウザ / モバイル (将来: Expo)              │
└────────────────┬───────────────────────────────┘
                 │ HTTPS
┌────────────────▼───────────────────────────────┐
│  Vercel (apps/web: Next.js 15 App Router)      │
│   ├─ React Server Components                   │
│   ├─ Server Actions (CRUD + ビジネスロジック)  │
│   └─ Route Handlers (OAuth callback, webhook) │
└────┬─────────────────────────────┬─────────────┘
     │ Prisma                      │ OAuth / API
┌────▼──────────────┐     ┌────────▼───────────┐
│  Supabase         │     │  Google Calendar   │
│   ├─ PostgreSQL   │     │  API               │
│   ├─ Auth         │     └────────────────────┘
│   └─ Storage      │
└───────────────────┘
```

---

## レイヤ分割

### 1. UI 層 (`apps/web/src/app/`, `components/`)
- React Server Components が基本。クライアント状態が必要なときだけ `"use client"`。
- shadcn/ui のコンポーネントを `components/ui/` に配置し、業務コンポーネントは `features/<domain>/` に配置。

### 2. フィーチャー層 (`apps/web/src/features/<domain>/`)
- ドメインごとの UI + Server Action を同居させる。
- 例: `features/kakochou/entry-form.tsx`, `features/kakochou/actions.ts`

### 3. ロジック層 (`apps/web/src/lib/`)
- 純粋関数のビジネスロジック（年忌計算・和暦変換・検索クエリ構築）。
- テスト容易性のため UI に依存させない。

### 4. データアクセス層 (`apps/web/src/lib/db/`)
- Prisma クライアントのラッパー `withTenant()` を唯一の DB 入口とする。
- RLS が正しく発動しているかをアプリ層でも二重に確認する。

### 5. 外部統合層 (`apps/web/src/lib/google/`, `lib/pdf/`)
- 外部 API・ライブラリとのやり取りはここに封じ込める。

---

## 要求の流れ (例: 法要登録)

```
[ユーザー]
   ↓ フォーム送信
[features/houyou/new-service-form.tsx]
   ↓ Server Action 呼出
[features/houyou/actions.ts → createMemorialService()]
   ↓ withTenant() で Prisma 呼出
[lib/db/ → prisma.memorialService.create()]
   ↓ PostgreSQL (RLS で tenant_id 自動フィルタ)
[DB 書込 成功]
   ↓ lib/google/createCalendarEvent()
[Google Calendar API]
   ↓ 成功
[revalidatePath() で UI 更新]
```

---

## 可観測性 (将来)

- Phase1: Vercel のログと Supabase のログで十分。
- Phase2: Sentry（エラートラッキング）、PostHog or Amplitude（利用分析）。
- 個人情報はイベントプロパティに入れない。
