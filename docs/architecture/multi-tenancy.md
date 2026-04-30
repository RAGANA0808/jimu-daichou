# マルチテナント方針

寺務台帳は、将来の複数寺院展開を見据え、**Day 1 から「共有 DB + tenant_id + Row Level Security (RLS)」方式** で構築する。自寺のみ運用している段階でも、RLS を有効化し、自寺テナントを 1 行作成して運用する。

> **RLS を後から有効化する」は事故の元**。ポリシー未整備の時期に開発したコードが `tenant_id` 条件を省略していることに後から気づき、他寺院データを漏洩させる事故が起きる。最初から有効化しておけば、開発中に必ず「見えない」「書けない」状態を経験するため、抜け漏れが開発者に即座にフィードバックされる。

---

## 基本方針

1. **全テーブルに `tenantId` カラムを必須化**
2. **PostgreSQL RLS を全テーブルで有効化**
3. **セッション変数 `app.current_tenant_id` をリクエスト毎に設定**
4. **アプリ層でも `withTenant()` で二重に検証**

---

## スキーマ規約

```prisma
model Example {
  id        String   @id @default(cuid())
  tenantId  String   // ← 必須
  // ... other fields
  tenant    Tenant   @relation(fields: [tenantId], references: [id])

  @@index([tenantId])
}
```

- `tenantId` を含まないテーブルは `Tenant` テーブル自身のみ。
- 全外部キーの先も同じテナントであることを、アプリ層で検証する。

---

## RLS ポリシー例

```sql
ALTER TABLE households ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON households
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
```

- `USING` で読取制限、`WITH CHECK` で書込制限。
- `app.current_tenant_id` が未設定時は何も読めない（= 安全側）。

---

## セッション変数の設定

```typescript
// lib/db/with-tenant.ts (疑似コード)
export async function withTenant<T>(
  tenantId: string,
  fn: (tx: PrismaClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SET LOCAL app.current_tenant_id = '${validateUuid(tenantId)}'`,
    );
    return fn(tx as PrismaClient);
  });
}
```

- **Server Action の最初で必ず `withTenant()` を呼ぶ**。
- `tenantId` はセッションから取得する。クライアントから受け取ってはならない。
- SQL インジェクション対策として、必ず UUID 形式を事前検証。

---

## アプリ層での二重防御

RLS があっても、以下を必ず実施:

1. Server Action の入口で `getCurrentTenantId(session)` を呼び、`tenantId` を取得。
2. すべての Prisma クエリを `withTenant()` でラップ。
3. 外部キー参照時も、そのリソースが自テナントのものか明示的に確認。

---

## Phase 別の運用

- **Phase 1 (自寺のみ)**: テナント 1 行 (`INITIAL_TENANT_*` 環境変数から seed)。RLS は ON。ユーザーは 1 テナントのみ所属。
- **Phase 2 (他寺院提供)**: テナント招待機能、Stripe による課金、テナント切替 UI (1 ユーザーが複数寺院に関わるケースは稀だが、本山・末寺関係等を想定)。
- **Phase 3 (スケール)**: データベース水平分割や、大規模テナント向けの専用 DB への逃し弁を検討。

---

## テスト観点

- `tenantId` を混在させた統合テストで、他テナントの行が読めない/書けないことを確認。
- CI で以下を強制:
  - 全モデルに `tenantId` と `@@index([tenantId])` があること (lint or schema 検証スクリプト)
  - 全テーブルに RLS が有効 (マイグレーション検証)
