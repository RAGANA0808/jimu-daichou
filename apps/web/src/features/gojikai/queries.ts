import 'server-only';
import type {
  Household,
  InvoiceStatus,
  MaintenanceFeeInvoice,
  MaintenanceFeePlan,
  Prisma,
} from '@prisma/client';
import { requireCurrentTenantId } from '@/lib/auth';
import { assertValidUuid, withTenant, withTenantOrTx } from '@/lib/db';
import {
  summarizeFiscalYear,
  type FiscalYearSummary,
  type InvoiceForSummary,
} from '@/lib/gojikai';

export type HouseholdLite = Pick<
  Household,
  'id' | 'householderName' | 'nameKana' | 'postalCode' | 'address'
>;

/** 会費台帳の 1 行 (世帯情報つき)。 */
export type FeePlanWithHousehold = MaintenanceFeePlan & {
  household: HouseholdLite;
};

/**
 * 護持会費 台帳の一覧。離檀していない世帯ぶんを かな順 で返す。
 * Phase 1 は 2000 件上限。
 */
export async function listFeePlans(): Promise<FeePlanWithHousehold[]> {
  const tenantId = await requireCurrentTenantId();
  return withTenant(tenantId, (tx) =>
    tx.maintenanceFeePlan.findMany({
      include: {
        household: {
          select: {
            id: true,
            householderName: true,
            nameKana: true,
            postalCode: true,
            address: true,
          },
        },
      },
      orderBy: [{ household: { nameKana: 'asc' } }],
      take: 2000,
    }),
  );
}

/** 指定世帯の会費台帳 (1 世帯 1 件。なければ null)。 */
export async function getFeePlanByHousehold(
  householdId: string,
  tx?: Prisma.TransactionClient,
): Promise<MaintenanceFeePlan | null> {
  assertValidUuid(householdId, 'householdId');
  return withTenantOrTx(tx, requireCurrentTenantId, (t) =>
    t.maintenanceFeePlan.findUnique({ where: { householdId } }),
  );
}

/**
 * 台帳がまだ無い (離檀していない) 世帯の一覧。台帳の新規作成フォームで選択肢にする。
 */
export async function listHouseholdsWithoutPlan(): Promise<HouseholdLite[]> {
  const tenantId = await requireCurrentTenantId();
  return withTenant(tenantId, async (tx) => {
    const households = await tx.household.findMany({
      where: { isActive: true, maintenanceFeePlan: null },
      select: {
        id: true,
        householderName: true,
        nameKana: true,
        postalCode: true,
        address: true,
      },
      orderBy: [{ nameKana: 'asc' }],
      take: 2000,
    });
    return households;
  });
}

export type InvoiceWithHousehold = MaintenanceFeeInvoice & {
  household: HouseholdLite;
};

export type FiscalYearView = {
  fiscalYear: number;
  invoices: InvoiceWithHousehold[];
  summary: FiscalYearSummary;
};

/**
 * 指定年度の請求一覧 + 集計。statusFilter を渡すと未納抽出などに使える。
 */
export async function getFiscalYearView(
  fiscalYear: number,
  statusFilter?: InvoiceStatus[],
): Promise<FiscalYearView> {
  const tenantId = await requireCurrentTenantId();
  const invoices = await withTenant(tenantId, (tx) =>
    tx.maintenanceFeeInvoice.findMany({
      where: {
        fiscalYear,
        ...(statusFilter && statusFilter.length > 0
          ? { status: { in: statusFilter } }
          : {}),
      },
      include: {
        household: {
          select: {
            id: true,
            householderName: true,
            nameKana: true,
            postalCode: true,
            address: true,
          },
        },
      },
      orderBy: [{ status: 'asc' }, { household: { nameKana: 'asc' } }],
      take: 5000,
    }),
  );

  const summaryInput: InvoiceForSummary[] = invoices.map((i) => ({
    amount: i.amount,
    paidAmount: i.paidAmount,
    status: i.status,
  }));

  return {
    fiscalYear,
    invoices,
    summary: summarizeFiscalYear(summaryInput),
  };
}

/**
 * 年度集計のみ (一覧を引かずに件数・金額・進捗だけ欲しいとき)。
 * フィルタ無しの全件で集計するため、未納抽出の前段にも使える。
 */
export async function getFiscalYearSummaryOnly(
  fiscalYear: number,
): Promise<FiscalYearSummary> {
  const tenantId = await requireCurrentTenantId();
  const invoices = await withTenant(tenantId, (tx) =>
    tx.maintenanceFeeInvoice.findMany({
      where: { fiscalYear },
      select: { amount: true, paidAmount: true, status: true },
      take: 5000,
    }),
  );
  return summarizeFiscalYear(invoices);
}

/** 指定世帯の請求履歴 (年度降順)。カルテで当年の請求・入金状況を見るのに使う。 */
export async function listInvoicesByHousehold(
  householdId: string,
  tx?: Prisma.TransactionClient,
): Promise<MaintenanceFeeInvoice[]> {
  assertValidUuid(householdId, 'householdId');
  return withTenantOrTx(tx, requireCurrentTenantId, (t) =>
    t.maintenanceFeeInvoice.findMany({
      where: { householdId },
      orderBy: [{ fiscalYear: 'desc' }],
      take: 200,
    }),
  );
}

/** 単一の請求 (詳細・入金記録ページで使用)。他テナントは RLS で null。 */
export async function getInvoiceById(
  id: string,
): Promise<InvoiceWithHousehold | null> {
  assertValidUuid(id, 'invoiceId');
  const tenantId = await requireCurrentTenantId();
  return withTenant(tenantId, (tx) =>
    tx.maintenanceFeeInvoice.findUnique({
      where: { id },
      include: {
        household: {
          select: {
            id: true,
            householderName: true,
            nameKana: true,
            postalCode: true,
            address: true,
          },
        },
      },
    }),
  );
}

/**
 * 既に請求が存在する年度の一覧 (年度切替セレクトの候補に使う)。降順。
 */
export async function listInvoiceFiscalYears(): Promise<number[]> {
  const tenantId = await requireCurrentTenantId();
  const rows = await withTenant(tenantId, (tx) =>
    tx.maintenanceFeeInvoice.findMany({
      distinct: ['fiscalYear'],
      select: { fiscalYear: true },
      orderBy: [{ fiscalYear: 'desc' }],
      take: 100,
    }),
  );
  return rows.map((r) => r.fiscalYear);
}

/** 未納・一部入金の世帯を督促状の宛先候補として抽出する。 */
export type DunningCandidate = {
  invoiceId: string;
  householdId: string;
  householderName: string;
  postalCode: string | null;
  address: string | null;
  amount: number;
  paidAmount: number;
  outstanding: number;
  status: InvoiceStatus;
  missingAddress: boolean;
};

export async function listDunningCandidatesForYear(
  fiscalYear: number,
): Promise<DunningCandidate[]> {
  const tenantId = await requireCurrentTenantId();
  const invoices = await withTenant(tenantId, (tx) =>
    tx.maintenanceFeeInvoice.findMany({
      where: { fiscalYear, status: { in: ['UNPAID', 'PARTIAL'] } },
      include: {
        household: {
          select: {
            id: true,
            householderName: true,
            postalCode: true,
            address: true,
          },
        },
      },
      orderBy: [{ household: { nameKana: 'asc' } }],
      take: 5000,
    }),
  );

  return invoices.map((i) => ({
    invoiceId: i.id,
    householdId: i.householdId,
    householderName: i.household.householderName,
    postalCode: i.household.postalCode,
    address: i.household.address,
    amount: i.amount,
    paidAmount: i.paidAmount,
    outstanding: Math.max(0, i.amount - i.paidAmount),
    status: i.status,
    missingAddress: !i.household.address,
  }));
}
