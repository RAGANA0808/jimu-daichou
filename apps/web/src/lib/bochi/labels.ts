import type { GraveMaintenanceMethod, InvoiceStatus } from '@prisma/client';

/** 納入区分の日本語ラベル。 */
export const GRAVE_MAINTENANCE_METHOD_LABELS: Record<
  GraveMaintenanceMethod,
  string
> = {
  BANK_TRANSFER: '口座振替',
  POSTAL_TRANSFER: '郵便振替',
  ANNUAL_LUMP: '年払 (一括)',
  CASH: '現金',
  OTHER: 'その他',
};

/** 納入区分の表示順。 */
export const GRAVE_MAINTENANCE_METHOD_ORDER: GraveMaintenanceMethod[] = [
  'BANK_TRANSFER',
  'POSTAL_TRANSFER',
  'ANNUAL_LUMP',
  'CASH',
  'OTHER',
];

/** 入金状況の日本語ラベル。 */
export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  UNPAID: '未納',
  PARTIAL: '一部入金',
  PAID: '完納',
};

/** 入金状況の Badge variant (色のみに依存しない表示は Badge 側がアイコンで担保)。 */
export const INVOICE_STATUS_BADGE_VARIANT: Record<
  InvoiceStatus,
  'success' | 'warning' | 'danger'
> = {
  UNPAID: 'danger',
  PARTIAL: 'warning',
  PAID: 'success',
};
