-- MEMORIAL-EXPIRY ウェーブ: 法要終了時刻 (N-6) + 発送明細 ShipmentRecipientItem (A-2 重複案内防止)。
-- 合祀候補抽出 (G-5) / 改葬・墓じまい・合祀移行 (G-8) は既存 GravePlotStatus / GraveContractStatus /
-- Burial.removedAt の状態遷移で表現するためスキーマ変更なし。
-- RLS パターンは 20260605040000_add_maintenance_fee_models / 20260607030000_add_permission_audit を踏襲する。

-- N-6: 法要終了時刻。scheduledAt と同型 (TIMESTAMP(3) / @db 指定なし) で JST 保存。null は未設定。
ALTER TABLE "MemorialService" ADD COLUMN "endTime" TIMESTAMP(3);

-- A-2: 発送明細 (突合キー構造化)。新規テーブルなので既存行への DEFAULT 後埋め問題は発生しない。
CREATE TABLE "ShipmentRecipientItem" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "recipientId" UUID NOT NULL,
    "targetPersonId" UUID,
    "deathLedgerEntryId" UUID,
    "anniversaryKaiki" INTEGER NOT NULL,
    "targetYear" INTEGER NOT NULL,
    "secularName" TEXT NOT NULL,
    "anniversaryName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentRecipientItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShipmentRecipientItem_tenantId_idx" ON "ShipmentRecipientItem"("tenantId");

-- CreateIndex
CREATE INDEX "ShipmentRecipientItem_recipientId_idx" ON "ShipmentRecipientItem"("recipientId");

-- CreateIndex: 既送判定の主索引 (同一対象×同一回忌×同一年)。
CREATE INDEX "ShipmentRecipientItem_tenantId_targetPersonId_anniversaryKai_idx"
  ON "ShipmentRecipientItem"("tenantId", "targetPersonId", "anniversaryKaiki", "targetYear");

-- AddForeignKey: テナントは RESTRICT (記録が孤立しないように)。
ALTER TABLE "ShipmentRecipientItem" ADD CONSTRAINT "ShipmentRecipientItem_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: 親宛先 (ShipmentRecipient) は CASCADE (宛先削除で明細も消える)。
ALTER TABLE "ShipmentRecipientItem" ADD CONSTRAINT "ShipmentRecipientItem_recipientId_fkey"
  FOREIGN KEY ("recipientId") REFERENCES "ShipmentRecipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: 対象故人は SET NULL (承継・Person 消失後も記録は残す)。
ALTER TABLE "ShipmentRecipientItem" ADD CONSTRAINT "ShipmentRecipientItem_targetPersonId_fkey"
  FOREIGN KEY ("targetPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row Level Security: テナント分離ポリシーを適用する (既存パターン踏襲)。
-- セッション変数 app.current_tenant_id は lib/db/with-tenant.ts で SET LOCAL される。
ALTER TABLE "ShipmentRecipientItem" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "ShipmentRecipientItem"
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
