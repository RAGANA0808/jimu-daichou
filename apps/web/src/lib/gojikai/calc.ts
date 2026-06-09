/**
 * 護持会費 (E07) の純関数ロジック。DB アクセスなし・Vitest で網羅する。
 *
 * - 請求生成: 台帳から年度請求のドラフトを作る (重複除外はここで決める)
 * - 入金消込: 請求への入金額から status (未納/一部/完納) と新 paidAmount を判定する
 * - 集計: 年度の請求群から件数・金額・進捗を出す
 *
 * 金額はすべて円・整数。負数や非整数は弾く前提 (入口の Server Action で検証)。
 */

import type { InvoiceStatus, MaintenanceFeeMethod } from '@prisma/client';

/** 入金消込で会計 Transaction を自動起票するカテゴリ (二重起票防止の対象)。 */
export const MAINTENANCE_FEE_CATEGORY = 'MAINTENANCE_FEE' as const;

/**
 * paidAmount と請求額から入金状況を判定する。
 * - paidAmount <= 0       → 未納 (UNPAID)
 * - 0 < paidAmount < 請求 → 一部 (PARTIAL)
 * - paidAmount >= 請求    → 完納 (PAID) … 過入金も完納扱い
 *
 * 請求額が 0 円の場合 (会費 0 の世帯) は、入金 0 なら完納扱いとする
 * (請求すべき額がないため未納にしない)。
 */
export function computeInvoiceStatus(
  paidAmount: number,
  amount: number,
): InvoiceStatus {
  if (amount <= 0) return 'PAID';
  if (paidAmount <= 0) return 'UNPAID';
  if (paidAmount >= amount) return 'PAID';
  return 'PARTIAL';
}

/** 1 世帯ぶんの会費台帳 (請求生成の入力)。 */
export type FeePlanSource = {
  householdId: string;
  annualAmount: number;
  method: MaintenanceFeeMethod;
  isActive: boolean;
};

/** 生成すべき年度請求 1 件のドラフト (DB 書込み前)。 */
export type InvoiceDraft = {
  householdId: string;
  fiscalYear: number;
  amount: number;
  method: MaintenanceFeeMethod;
};

export type GenerateInvoicesResult = {
  /** 新規に作成すべき請求ドラフト。 */
  drafts: InvoiceDraft[];
  /** 既に当年度の請求があるため除外した世帯数 (重複生成防止)。 */
  skippedExisting: number;
  /** 休止台帳 (isActive=false) のため除外した世帯数。 */
  skippedInactive: number;
};

/**
 * 年度請求の一括生成ドラフトを作る純関数。
 *
 * - 同一世帯の当年度請求が既にある (existingHouseholdIds に含まれる) 場合は除外する。
 * - 休止台帳 (isActive=false) は除外する。
 * - amount は台帳の annualAmount をその時点のスナップショットとして写す。
 */
export function generateInvoiceDrafts(
  plans: FeePlanSource[],
  fiscalYear: number,
  existingHouseholdIds: Iterable<string>,
): GenerateInvoicesResult {
  const existing = new Set(existingHouseholdIds);
  const drafts: InvoiceDraft[] = [];
  let skippedExisting = 0;
  let skippedInactive = 0;

  for (const plan of plans) {
    if (!plan.isActive) {
      skippedInactive += 1;
      continue;
    }
    if (existing.has(plan.householdId)) {
      skippedExisting += 1;
      continue;
    }
    drafts.push({
      householdId: plan.householdId,
      fiscalYear,
      amount: plan.annualAmount,
      method: plan.method,
    });
  }

  return { drafts, skippedExisting, skippedInactive };
}

/** 入金消込の入力 (現在の請求状態 + 追加入金額)。 */
export type ReconcileInput = {
  /** 現在の請求額 (円)。 */
  amount: number;
  /** 現在までの入金累計 (円)。 */
  currentPaidAmount: number;
  /** 今回の追加入金額 (円)。0 や負数は呼び出し側で弾く想定だが、防御的に下限 0 でクランプする。 */
  payment: number;
};

export type ReconcileResult = {
  /** 入金反映後の累計 (円)。 */
  newPaidAmount: number;
  /** 入金反映後の状況。 */
  status: InvoiceStatus;
  /** この入金で完納に到達したか (未完納→完納の遷移)。 */
  becamePaid: boolean;
};

/**
 * 1 件の請求に追加入金を反映し、新しい累計と status を返す純関数。
 * 会計起票は呼び出し側 (Server Action) が今回の payment 額で行う。
 */
export function reconcilePayment(input: ReconcileInput): ReconcileResult {
  const payment = input.payment > 0 ? input.payment : 0;
  const prevStatus = computeInvoiceStatus(input.currentPaidAmount, input.amount);
  const newPaidAmount = input.currentPaidAmount + payment;
  const status = computeInvoiceStatus(newPaidAmount, input.amount);
  return {
    newPaidAmount,
    status,
    becamePaid: prevStatus !== 'PAID' && status === 'PAID',
  };
}

/** 年度集計の入力 1 件。 */
export type InvoiceForSummary = {
  amount: number;
  paidAmount: number;
  status: InvoiceStatus;
};

export type FiscalYearSummary = {
  /** 請求件数。 */
  invoiceCount: number;
  /** 請求総額 (円)。 */
  totalBilled: number;
  /** 入金総額 (円)。 */
  totalPaid: number;
  /** 未収額 (円)。totalBilled - totalPaid を下限 0 でクランプ。 */
  outstanding: number;
  /** 未納 (UNPAID) 件数。 */
  unpaidCount: number;
  /** 一部入金 (PARTIAL) 件数。 */
  partialCount: number;
  /** 完納 (PAID) 件数。 */
  paidCount: number;
  /**
   * 集金進捗率 (0〜100 の整数)。請求総額に対する入金総額の割合。
   * 請求総額が 0 のときは 100 とする (集めるべき額がない=完了)。
   */
  collectionRate: number;
};

/** 年度の請求群から集計 (件数・金額・進捗) を作る純関数。 */
export function summarizeFiscalYear(
  invoices: InvoiceForSummary[],
): FiscalYearSummary {
  let totalBilled = 0;
  let totalPaid = 0;
  let unpaidCount = 0;
  let partialCount = 0;
  let paidCount = 0;

  for (const inv of invoices) {
    totalBilled += inv.amount;
    totalPaid += inv.paidAmount;
    if (inv.status === 'UNPAID') unpaidCount += 1;
    else if (inv.status === 'PARTIAL') partialCount += 1;
    else paidCount += 1;
  }

  const outstanding = Math.max(0, totalBilled - totalPaid);
  const collectionRate =
    totalBilled <= 0
      ? 100
      : Math.min(100, Math.round((totalPaid / totalBilled) * 100));

  return {
    invoiceCount: invoices.length,
    totalBilled,
    totalPaid,
    outstanding,
    unpaidCount,
    partialCount,
    paidCount,
    collectionRate,
  };
}
