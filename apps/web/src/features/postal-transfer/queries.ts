import 'server-only';
import type {
  Household,
  PostalTransferAmountSource,
  PostalTransferSubject,
  Tenant,
} from '@prisma/client';
import { requireCurrentTenantId } from '@/lib/auth';
import { assertValidUuid, withTenant } from '@/lib/db';

export type HouseholdLite = Pick<
  Household,
  'id' | 'householderName' | 'nameKana' | 'postalCode' | 'address'
>;

const householdLiteSelect = {
  id: true,
  householderName: true,
  nameKana: true,
  postalCode: true,
  address: true,
} as const;

/** テナントの郵便振替 設定 (寺口座情報 + 印字オフセット)。 */
export type PostalTransferAccount = Pick<
  Tenant,
  | 'name'
  | 'postalAccountName'
  | 'postalAccountSymbol'
  | 'postalAccountNumber'
  | 'postalTransferNote'
  | 'postalPrintOffsetXMm'
  | 'postalPrintOffsetYMm'
>;

/** 寺口座情報 + 印字オフセットを取得する (設定欄の初期値・PDF 既定値)。 */
export async function getPostalTransferAccount(): Promise<PostalTransferAccount | null> {
  const tenantId = await requireCurrentTenantId();
  return withTenant(tenantId, (tx) =>
    tx.tenant.findUnique({
      where: { id: tenantId },
      select: {
        name: true,
        postalAccountName: true,
        postalAccountSymbol: true,
        postalAccountNumber: true,
        postalTransferNote: true,
        postalPrintOffsetXMm: true,
        postalPrintOffsetYMm: true,
      },
    }),
  );
}

/** 有効な科目テンプレ一覧 (休止は除外, 表示順)。 */
export async function listActiveSubjects(): Promise<PostalTransferSubject[]> {
  const tenantId = await requireCurrentTenantId();
  return withTenant(tenantId, (tx) =>
    tx.postalTransferSubject.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      take: 200,
    }),
  );
}

/** 管理画面用に全科目テンプレ (休止含む) を表示順で返す。 */
export async function listAllSubjects(): Promise<PostalTransferSubject[]> {
  const tenantId = await requireCurrentTenantId();
  return withTenant(tenantId, (tx) =>
    tx.postalTransferSubject.findMany({
      orderBy: [{ isActive: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
      take: 200,
    }),
  );
}

/** 単一の科目テンプレ (編集ページ用)。他テナントは RLS で null。 */
export async function getSubjectById(
  id: string,
): Promise<PostalTransferSubject | null> {
  assertValidUuid(id, 'subjectId');
  const tenantId = await requireCurrentTenantId();
  return withTenant(tenantId, (tx) =>
    tx.postalTransferSubject.findUnique({ where: { id } }),
  );
}

/** 離檀していない (isActive=true) 世帯を かな順 で返す。一括生成・単票生成の宛先。 */
export async function listActiveHouseholds(): Promise<HouseholdLite[]> {
  const tenantId = await requireCurrentTenantId();
  return withTenant(tenantId, (tx) =>
    tx.household.findMany({
      where: { isActive: true },
      select: householdLiteSelect,
      orderBy: [{ nameKana: 'asc' }],
      take: 5000,
    }),
  );
}

/** 単一世帯 (離檀世帯も詳細からの単票生成は許容するが、宛名情報のみ)。 */
export async function getHouseholdLite(
  householdId: string,
): Promise<HouseholdLite | null> {
  assertValidUuid(householdId, 'householdId');
  const tenantId = await requireCurrentTenantId();
  return withTenant(tenantId, (tx) =>
    tx.household.findUnique({
      where: { id: householdId },
      select: householdLiteSelect,
    }),
  );
}

/**
 * 指定年度の「世帯別 初期金額」を科目連動元ごとに解決する。
 * - MAINTENANCE_FEE: その年度の護持会費請求額 (MaintenanceFeeInvoice.amount)
 * - GRAVE_MAINTENANCE: その世帯が契約する区画の年度管理料請求額の合計
 *
 * 返り値は householdId -> source -> 金額(円) のネスト Map。請求が無い世帯/区画は欠落 (= 0 扱い)。
 */
export type InitialAmountMap = Map<
  string,
  Partial<Record<PostalTransferAmountSource, number>>
>;

export async function getInitialAmountsForYear(
  fiscalYear: number,
): Promise<InitialAmountMap> {
  const tenantId = await requireCurrentTenantId();
  const map: InitialAmountMap = new Map();

  await withTenant(tenantId, async (tx) => {
    const [feeInvoices, graveInvoices] = await Promise.all([
      tx.maintenanceFeeInvoice.findMany({
        where: { fiscalYear },
        select: { householdId: true, amount: true },
        take: 5000,
      }),
      tx.graveMaintenanceInvoice.findMany({
        where: { fiscalYear },
        select: { amount: true, gravePlot: { select: { householdId: true } } },
        take: 5000,
      }),
    ]);

    for (const inv of feeInvoices) {
      const cur = map.get(inv.householdId) ?? {};
      cur.MAINTENANCE_FEE = (cur.MAINTENANCE_FEE ?? 0) + inv.amount;
      map.set(inv.householdId, cur);
    }

    for (const inv of graveInvoices) {
      const hid = inv.gravePlot.householdId;
      if (!hid) continue;
      const cur = map.get(hid) ?? {};
      cur.GRAVE_MAINTENANCE = (cur.GRAVE_MAINTENANCE ?? 0) + inv.amount;
      map.set(hid, cur);
    }
  });

  return map;
}
