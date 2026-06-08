import 'server-only';
import type { AuditAction, Prisma } from '@prisma/client';

/**
 * 監査ログ (AuditLog) の追記ヘルパ (PERMISSION P-3)。
 *
 * 既存の `withTenant(tenantId, tx => ...)` トランザクション内から `tx` を渡して呼ぶ。
 * mutate 成功後・return 直前に1行差し込むだけで「誰が何にどの操作をしたか」を残す。
 *
 * 【失敗ポリシー】同一 tx 内なので recordAudit が失敗すればアクション本体ごと
 * ロールバックされる。監査が欠ける状態を許さない (重要操作の網羅が目的)。
 *
 * 【個人情報非載 (厳守)】`summary` には氏名・住所・電話・メール・本文を **絶対に渡さない**。
 * ID・件数・年度・状態遷移・enum 値のみで構成すること。entityId は UUID なので PII ではない。
 * ヘルパ内では値整形しない (PII フィルタは呼び出し側責務 + レビューで担保)。
 */
export type AuditEntityType =
  | 'Household'
  | 'Person'
  | 'DeathLedgerEntry'
  | 'MemorialService'
  | 'Toba'
  | 'GravePlot'
  | 'GravePlotArea'
  | 'Burial'
  | 'GraveContract'
  | 'Transaction'
  | 'HouseholdSuccession'
  | 'MaintenanceFeePlan'
  | 'MaintenanceFeeInvoice'
  | 'GraveMaintenancePlan'
  | 'GraveMaintenanceInvoice'
  | 'PostalTransferSubject'
  | 'Tag'
  | 'HouseholdTag'
  | 'ShipmentBatch'
  | 'User'
  | 'Tenant'
  | 'Document'
  | 'TempleEvent'
  // 複数モデルにまたがる一括操作 (個別の行 id を持たない)。entityId は null。
  | 'Import'
  | 'Export';

export type RecordAuditInput = {
  actorId: string | null;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string | null;
  summary: string;
};

/**
 * 監査ログを1件追記する。
 *
 * @param tx       withTenant 内の TransactionClient (SET LOCAL app.current_tenant_id 済み)
 * @param tenantId data に明示する tenantId (RLS WITH CHECK を確実に通すため)
 * @param input    記録内容 (summary に個人情報を含めないこと)
 */
export async function recordAudit(
  tx: Prisma.TransactionClient,
  tenantId: string,
  input: RecordAuditInput,
): Promise<void> {
  await tx.auditLog.create({
    data: {
      tenantId,
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      summary: input.summary,
    },
    select: { id: true },
  });
}
