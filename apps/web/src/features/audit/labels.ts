import { AuditAction } from '@prisma/client';

/** 監査操作種別の日本語ラベル (roles.ts の流儀に倣う)。 */
export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  [AuditAction.CREATE]: '作成',
  [AuditAction.UPDATE]: '更新',
  [AuditAction.DELETE]: '除外 (論理削除)',
  [AuditAction.EXPORT]: '書出',
  [AuditAction.APPROVE]: '承認',
  [AuditAction.CONNECT]: '連携開始',
  [AuditAction.DISCONNECT]: '連携解除',
  [AuditAction.ROLE_CHANGE]: '役割変更',
  [AuditAction.OTHER]: 'その他',
};

export function auditActionLabel(action: AuditAction): string {
  return AUDIT_ACTION_LABELS[action];
}

/** 監査対象種別 (entityType) の日本語ラベル。未登録の値はそのまま表示する。 */
export const AUDIT_ENTITY_LABELS: Record<string, string> = {
  Household: '世帯',
  Person: '家族構成員',
  DeathLedgerEntry: '過去帳',
  MemorialService: '法要',
  Toba: '塔婆',
  GravePlot: '区画',
  GravePlotArea: '区画エリア',
  Burial: '納骨',
  GraveContract: '区画契約',
  Transaction: '入出金',
  HouseholdSuccession: '承継',
  MaintenanceFeePlan: '護持会費台帳',
  MaintenanceFeeInvoice: '護持会費請求',
  GraveMaintenancePlan: '管理料台帳',
  GraveMaintenanceInvoice: '管理料請求',
  PostalTransferSubject: '郵便振替科目',
  Tag: 'タグ',
  HouseholdTag: '世帯タグ',
  ShipmentBatch: '発送',
  User: 'ユーザー',
  Tenant: '寺院',
  Import: '取込',
  Export: '書出',
};

export function auditEntityLabel(entityType: string): string {
  return AUDIT_ENTITY_LABELS[entityType] ?? entityType;
}
