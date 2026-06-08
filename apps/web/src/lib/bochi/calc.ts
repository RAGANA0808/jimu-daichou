/**
 * 墓地 年間管理料 (E27) の純関数ロジック。DB アクセスなし・Vitest で網羅する。
 *
 * 護持会費 (E07 / 世帯単位) と異なり、こちらは「区画 (GravePlot) 単位」で賦課する。
 * 課金主体が区画である点が E07 との本質的な違いで、生成・消込・集計はすべて
 * gravePlotId をキーに行う (householdId は催告状の宛名解決にのみ使う)。
 *
 * - 請求生成: 台帳から年度請求のドラフトを作る (重複除外はここで決める)
 * - 入金消込: 請求への入金額から status (未納/一部/完納) と新 paidAmount を判定する
 * - 集計: 年度の請求群から件数・金額・進捗を出す
 * - 滞納集計: 区画ごとに「経過年数・累積未納額」を出す (滞納区画一覧の元データ)
 *
 * 金額はすべて円・整数。負数や非整数は弾く前提 (入口の Server Action で検証)。
 */

import type { GraveMaintenanceMethod, InvoiceStatus } from '@prisma/client';

/**
 * 入金消込で会計 Transaction を自動起票するカテゴリ。
 * 会計科目体系 (E08) を前提にしないため category=OTHER とし、memo で護持会費と区別する。
 */
export const GRAVE_MAINTENANCE_CATEGORY = 'OTHER' as const;

/** 入金消込で自動起票する Transaction の memo (護持会費の入金と取り違えないための識別子)。 */
export const GRAVE_MAINTENANCE_TRANSACTION_MEMO = '墓地管理料 入金 (請求消込)';

/**
 * paidAmount と請求額から入金状況を判定する。
 * - amount <= 0           → 完納 (請求すべき額がない)
 * - paidAmount <= 0       → 未納 (UNPAID)
 * - 0 < paidAmount < 請求 → 一部 (PARTIAL)
 * - paidAmount >= 請求    → 完納 (PAID) … 過入金も完納扱い
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

/** 1 区画ぶんの管理料台帳 (請求生成の入力)。 */
export type GravePlanSource = {
  gravePlotId: string;
  annualAmount: number;
  method: GraveMaintenanceMethod;
  isActive: boolean;
};

/** 生成すべき年度請求 1 件のドラフト (DB 書込み前)。 */
export type InvoiceDraft = {
  gravePlotId: string;
  fiscalYear: number;
  amount: number;
  method: GraveMaintenanceMethod;
};

export type GenerateInvoicesResult = {
  /** 新規に作成すべき請求ドラフト。 */
  drafts: InvoiceDraft[];
  /** 既に当年度の請求があるため除外した区画数 (重複生成防止)。 */
  skippedExisting: number;
  /** 休止台帳 (isActive=false) のため除外した区画数。 */
  skippedInactive: number;
};

/**
 * 年度請求の一括生成ドラフトを作る純関数。
 *
 * - 同一区画の当年度請求が既にある (existingGravePlotIds に含まれる) 場合は除外する。
 * - 休止台帳 (isActive=false) は除外する。
 * - amount は台帳の annualAmount をその時点のスナップショットとして写す。
 */
export function generateInvoiceDrafts(
  plans: GravePlanSource[],
  fiscalYear: number,
  existingGravePlotIds: Iterable<string>,
): GenerateInvoicesResult {
  const existing = new Set(existingGravePlotIds);
  const drafts: InvoiceDraft[] = [];
  let skippedExisting = 0;
  let skippedInactive = 0;

  for (const plan of plans) {
    if (!plan.isActive) {
      skippedInactive += 1;
      continue;
    }
    if (existing.has(plan.gravePlotId)) {
      skippedExisting += 1;
      continue;
    }
    drafts.push({
      gravePlotId: plan.gravePlotId,
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
 * 会計起票は呼び出し側 (Server Action) が累計額で行う (二重起票しない)。
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

// =========================================
// 滞納集計 (区画ベース)
// =========================================
// 区画ごとに、未納が残る年度から「経過年数」と「累積未納額」を出す。
// 経過年数 = 現在年度 - 最古の未納年度 + 1 (例: 2024 が未納で現在 2026 なら 3 年滞納)。

/** 滞納集計の入力 1 件 (請求 1 件ぶん)。 */
export type DelinquencyInvoiceInput = {
  gravePlotId: string;
  fiscalYear: number;
  amount: number;
  paidAmount: number;
  status: InvoiceStatus;
};

/** 区画 1 件ぶんの滞納サマリ。 */
export type PlotDelinquency = {
  gravePlotId: string;
  /** 未納が残る最古の年度 (未収のある年度の最小値)。 */
  oldestUnpaidYear: number;
  /** 直近の未納年度 (未収のある年度の最大値)。 */
  latestUnpaidYear: number;
  /** 経過年数 (現在年度 - 最古未納年度 + 1。下限 1)。 */
  elapsedYears: number;
  /** 未納のある年度数 (一部入金も含む)。 */
  unpaidYearCount: number;
  /** 累積未納額 (各年度の amount-paidAmount を下限 0 で合算)。 */
  totalOutstanding: number;
};

/**
 * 請求群を区画ごとにまとめ、未収の残る区画の滞納サマリを返す純関数。
 *
 * - 各請求の未収額 = max(0, amount - paidAmount)。未収 0 の請求は集計に含めない。
 * - 未収の残る年度が 1 つ以上ある区画のみ返す (完納済み区画は対象外)。
 * - 累積未納額の多い順 → 経過年数の多い順 で並べる (督促優先度の高い順)。
 *
 * @param invoices 集計対象の全請求 (複数年度ぶん)。
 * @param currentFiscalYear 経過年数の起点となる現在年度 (西暦)。
 */
export function aggregateDelinquencies(
  invoices: DelinquencyInvoiceInput[],
  currentFiscalYear: number,
): PlotDelinquency[] {
  const byPlot = new Map<
    string,
    {
      oldestUnpaidYear: number;
      latestUnpaidYear: number;
      unpaidYearCount: number;
      totalOutstanding: number;
    }
  >();

  for (const inv of invoices) {
    const outstanding = Math.max(0, inv.amount - inv.paidAmount);
    if (outstanding <= 0) continue;

    const cur = byPlot.get(inv.gravePlotId);
    if (cur) {
      cur.oldestUnpaidYear = Math.min(cur.oldestUnpaidYear, inv.fiscalYear);
      cur.latestUnpaidYear = Math.max(cur.latestUnpaidYear, inv.fiscalYear);
      cur.unpaidYearCount += 1;
      cur.totalOutstanding += outstanding;
    } else {
      byPlot.set(inv.gravePlotId, {
        oldestUnpaidYear: inv.fiscalYear,
        latestUnpaidYear: inv.fiscalYear,
        unpaidYearCount: 1,
        totalOutstanding: outstanding,
      });
    }
  }

  const result: PlotDelinquency[] = [];
  for (const [gravePlotId, v] of byPlot) {
    const elapsedYears = Math.max(1, currentFiscalYear - v.oldestUnpaidYear + 1);
    result.push({
      gravePlotId,
      oldestUnpaidYear: v.oldestUnpaidYear,
      latestUnpaidYear: v.latestUnpaidYear,
      elapsedYears,
      unpaidYearCount: v.unpaidYearCount,
      totalOutstanding: v.totalOutstanding,
    });
  }

  result.sort((a, b) => {
    if (b.totalOutstanding !== a.totalOutstanding) {
      return b.totalOutstanding - a.totalOutstanding;
    }
    return b.elapsedYears - a.elapsedYears;
  });

  return result;
}
