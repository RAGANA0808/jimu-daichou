import 'server-only';
import type {
  GraveMaintenanceInvoice,
  GraveMaintenancePlan,
  GravePlot,
  Household,
  InvoiceStatus,
} from '@prisma/client';
import { requireCurrentTenantId } from '@/lib/auth';
import { assertValidUuid, withTenant } from '@/lib/db';
import {
  aggregateDelinquencies,
  summarizeFiscalYear,
  type DelinquencyInvoiceInput,
  type FiscalYearSummary,
  type InvoiceForSummary,
  type PlotDelinquency,
} from '@/lib/bochi';

/** 区画の最小情報 (台帳・請求一覧の表示用)。 */
export type GravePlotLite = Pick<
  GravePlot,
  'id' | 'plotNumber' | 'plotType' | 'status'
> & {
  household: Pick<
    Household,
    'id' | 'householderName' | 'nameKana' | 'postalCode' | 'address'
  > | null;
};

const gravePlotLiteSelect = {
  id: true,
  plotNumber: true,
  plotType: true,
  status: true,
  household: {
    select: {
      id: true,
      householderName: true,
      nameKana: true,
      postalCode: true,
      address: true,
    },
  },
} as const;

/** 管理料台帳の 1 行 (区画情報つき)。 */
export type GravePlanWithPlot = GraveMaintenancePlan & {
  gravePlot: GravePlotLite;
};

/**
 * 墓地管理料 台帳の一覧。区画番号順で返す。Phase 1 は 5000 件上限。
 */
export async function listGravePlans(): Promise<GravePlanWithPlot[]> {
  const tenantId = await requireCurrentTenantId();
  return withTenant(tenantId, (tx) =>
    tx.graveMaintenancePlan.findMany({
      include: { gravePlot: { select: gravePlotLiteSelect } },
      orderBy: [{ gravePlot: { plotNumber: 'asc' } }],
      take: 5000,
    }),
  );
}

/** 指定区画の管理料台帳 (1 区画 1 件。なければ null)。 */
export async function getGravePlanByPlot(
  gravePlotId: string,
): Promise<GraveMaintenancePlan | null> {
  assertValidUuid(gravePlotId, 'gravePlotId');
  const tenantId = await requireCurrentTenantId();
  return withTenant(tenantId, (tx) =>
    tx.graveMaintenancePlan.findUnique({ where: { gravePlotId } }),
  );
}

/**
 * 台帳がまだ無い区画の一覧 (台帳の新規作成フォームで選択肢にする)。
 * 墓じまい済 (CLOSED) は対象外。区画番号順。
 */
export async function listGravePlotsWithoutPlan(): Promise<GravePlotLite[]> {
  const tenantId = await requireCurrentTenantId();
  return withTenant(tenantId, (tx) =>
    tx.gravePlot.findMany({
      where: { status: { not: 'CLOSED' }, graveMaintenancePlan: null },
      select: gravePlotLiteSelect,
      orderBy: [{ plotNumber: 'asc' }],
      take: 5000,
    }),
  );
}

/** 編集画面用: 単一区画の最小情報 (固定表示)。 */
export async function getGravePlotLiteById(
  gravePlotId: string,
): Promise<GravePlotLite | null> {
  assertValidUuid(gravePlotId, 'gravePlotId');
  const tenantId = await requireCurrentTenantId();
  return withTenant(tenantId, (tx) =>
    tx.gravePlot.findUnique({
      where: { id: gravePlotId },
      select: gravePlotLiteSelect,
    }),
  );
}

export type InvoiceWithPlot = GraveMaintenanceInvoice & {
  gravePlot: GravePlotLite;
};

export type FiscalYearView = {
  fiscalYear: number;
  invoices: InvoiceWithPlot[];
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
    tx.graveMaintenanceInvoice.findMany({
      where: {
        fiscalYear,
        ...(statusFilter && statusFilter.length > 0
          ? { status: { in: statusFilter } }
          : {}),
      },
      include: { gravePlot: { select: gravePlotLiteSelect } },
      orderBy: [{ status: 'asc' }, { gravePlot: { plotNumber: 'asc' } }],
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

/** 指定区画の請求履歴 (年度降順)。区画詳細・カルテで状況を見るのに使う。 */
export async function listInvoicesByPlot(
  gravePlotId: string,
): Promise<GraveMaintenanceInvoice[]> {
  assertValidUuid(gravePlotId, 'gravePlotId');
  const tenantId = await requireCurrentTenantId();
  return withTenant(tenantId, (tx) =>
    tx.graveMaintenanceInvoice.findMany({
      where: { gravePlotId },
      orderBy: [{ fiscalYear: 'desc' }],
      take: 200,
    }),
  );
}

/** 単一の請求 (詳細・入金記録ページで使用)。他テナントは RLS で null。 */
export async function getInvoiceById(
  id: string,
): Promise<InvoiceWithPlot | null> {
  assertValidUuid(id, 'invoiceId');
  const tenantId = await requireCurrentTenantId();
  return withTenant(tenantId, (tx) =>
    tx.graveMaintenanceInvoice.findUnique({
      where: { id },
      include: { gravePlot: { select: gravePlotLiteSelect } },
    }),
  );
}

/**
 * 既に請求が存在する年度の一覧 (年度切替セレクトの候補に使う)。降順。
 */
export async function listInvoiceFiscalYears(): Promise<number[]> {
  const tenantId = await requireCurrentTenantId();
  const rows = await withTenant(tenantId, (tx) =>
    tx.graveMaintenanceInvoice.findMany({
      distinct: ['fiscalYear'],
      select: { fiscalYear: true },
      orderBy: [{ fiscalYear: 'desc' }],
      take: 100,
    }),
  );
  return rows.map((r) => r.fiscalYear);
}

// =========================================
// 滞納集計 (区画ベース)
// =========================================

/** 滞納区画 1 件 (滞納サマリ + 区画・契約世帯情報)。 */
export type DelinquentPlot = PlotDelinquency & {
  plotNumber: string;
  householdId: string | null;
  householderName: string | null;
  postalCode: string | null;
  address: string | null;
  /** 契約世帯が未設定 (宛名解決できない) か。 */
  missingHousehold: boolean;
  /** 契約世帯はあるが住所が未登録か。 */
  missingAddress: boolean;
};

/**
 * 全年度の請求を区画ごとに滞納集計し、未収の残る区画一覧を返す。
 * 累積未納額の多い順 (純関数 aggregateDelinquencies が判定)。
 *
 * @param currentFiscalYear 経過年数の起点 (画面の当年度)。
 */
export async function listDelinquentPlots(
  currentFiscalYear: number,
): Promise<DelinquentPlot[]> {
  const tenantId = await requireCurrentTenantId();

  return withTenant(tenantId, async (tx) => {
    const invoices = await tx.graveMaintenanceInvoice.findMany({
      where: { status: { in: ['UNPAID', 'PARTIAL'] } },
      select: {
        gravePlotId: true,
        fiscalYear: true,
        amount: true,
        paidAmount: true,
        status: true,
      },
      take: 20000,
    });

    const delinquencies = aggregateDelinquencies(
      invoices as DelinquencyInvoiceInput[],
      currentFiscalYear,
    );
    if (delinquencies.length === 0) return [];

    const plotIds = delinquencies.map((d) => d.gravePlotId);
    const plots = await tx.gravePlot.findMany({
      where: { id: { in: plotIds } },
      select: {
        id: true,
        plotNumber: true,
        household: {
          select: {
            id: true,
            householderName: true,
            postalCode: true,
            address: true,
          },
        },
      },
    });
    const plotMap = new Map(plots.map((p) => [p.id, p]));

    return delinquencies.map((d) => {
      const plot = plotMap.get(d.gravePlotId);
      const household = plot?.household ?? null;
      return {
        ...d,
        plotNumber: plot?.plotNumber ?? '—',
        householdId: household?.id ?? null,
        householderName: household?.householderName ?? null,
        postalCode: household?.postalCode ?? null,
        address: household?.address ?? null,
        missingHousehold: household === null,
        missingAddress: household !== null && !household.address,
      };
    });
  });
}

// =========================================
// 催告状の宛先候補 (区画 → 契約世帯の宛名解決)
// =========================================

/** 催告状の宛先 1 件 (区画ベース。宛名は契約世帯で解決)。 */
export type DemandCandidate = {
  gravePlotId: string;
  plotNumber: string;
  householdId: string | null;
  householderName: string | null;
  postalCode: string | null;
  address: string | null;
  oldestUnpaidYear: number;
  elapsedYears: number;
  unpaidYearCount: number;
  totalOutstanding: number;
  /** 宛名解決できない (契約世帯なし) か。発送対象から外す判定に使う。 */
  missingHousehold: boolean;
  /** 住所が未登録か。 */
  missingAddress: boolean;
};

/**
 * 催告状の宛先候補を抽出する。滞納区画のうち契約世帯のある区画を宛名解決して返す。
 * 宛名解決できない区画 (契約世帯なし) も missingHousehold=true で返し、UI 側で注意喚起する。
 */
export async function listDemandCandidates(
  currentFiscalYear: number,
): Promise<DemandCandidate[]> {
  const delinquents = await listDelinquentPlots(currentFiscalYear);
  return delinquents.map((d) => ({
    gravePlotId: d.gravePlotId,
    plotNumber: d.plotNumber,
    householdId: d.householdId,
    householderName: d.householderName,
    postalCode: d.postalCode,
    address: d.address,
    oldestUnpaidYear: d.oldestUnpaidYear,
    elapsedYears: d.elapsedYears,
    unpaidYearCount: d.unpaidYearCount,
    totalOutstanding: d.totalOutstanding,
    missingHousehold: d.missingHousehold,
    missingAddress: d.missingAddress,
  }));
}
