import type { InvoiceStatus, MaintenanceFeeMethod } from '@prisma/client';

/** 納入区分の日本語ラベル。 */
export const MAINTENANCE_FEE_METHOD_LABELS: Record<
  MaintenanceFeeMethod,
  string
> = {
  ANNUAL_LUMP: '年払 (一括)',
  BON_HIGAN: '盆彼岸集金',
  BANK_TRANSFER: '口座振替',
  CASH_COLLECTION: '手集金',
  OTHER: 'その他',
};

/** 納入区分の表示順。 */
export const MAINTENANCE_FEE_METHOD_ORDER: MaintenanceFeeMethod[] = [
  'ANNUAL_LUMP',
  'BON_HIGAN',
  'BANK_TRANSFER',
  'CASH_COLLECTION',
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
