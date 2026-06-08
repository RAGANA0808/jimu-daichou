/**
 * 区画 (GravePlot) のインポート定義。
 *
 * 墓地区画台帳 (CSV / Excel) を取り込む。1 行 = 区画 1 つ。
 *
 * - plotNumber は @@unique([tenantId, plotNumber]) のため、既存または同一ファイル内で
 *   重複したら警告し確定時はスキップする (二重登録防止)。
 * - エリア (areaId) はエリア名の一致で GravePlotArea へ解決する。一致が無ければ
 *   「未配置 (areaId=null)」として取り込み、警告で利用者に知らせる (取り込みは継続)。
 * - 契約世帯 (householdId) は施主名 or 施主ふりがなの正規化一致で既存世帯へ解決する。
 *   一致が無ければ警告のうえ未契約 (householdId=null) として取り込む。
 *
 * すべてのクエリは withTenant + RLS 配下で行う。
 */

import type { GravePlotStatus, GravePlotType, Prisma } from '@prisma/client';
import { normalizeKana } from '@/lib/search/normalize';
import { normalizeSecularName } from '@/lib/kakochou';
import { parseDateCell } from '../date-cell';
import type {
  ColumnDef,
  EntityImportDef,
  ExistingKeyIndex,
  RowIssue,
} from '../types';

/** 確定時に GravePlot を作る 1 行分のレコード。 */
export type GravePlotImportRecord = {
  plotNumber: string;
  plotType: GravePlotType;
  status: GravePlotStatus;
  contractDate: Date | null;
  contractPlan: string | null;
  areaId: string | null;
  householdId: string | null;
  memo: string | null;
};

/**
 * 区画インポート用の照合コンテキスト。
 * ExistingKeyIndex (plotNumber 重複集合) を満たしつつ、
 * エリア名 → areaId / 施主名・かな → householdId の名寄せ表を併せ持つ。
 */
export type GravePlotExistingIndex = ExistingKeyIndex & {
  areaIdByName(normalizedName: string): string | null;
  householdIdByMatchKey(key: string): string | null;
};

const COLUMNS: ColumnDef[] = [
  {
    key: 'plotNumber',
    label: '区画番号',
    required: true,
    hint: '墓地区画の識別番号 (例: A-12, 東-3)。重複は取り込みません。',
    aliases: ['区画', '番号', '墓所番号', '区画no', 'plotnumber', 'plotno', 'number'],
  },
  {
    key: 'plotType',
    label: '区画種別',
    required: true,
    hint: '個人墓 / 夫婦墓 / 家族墓 / 永代供養墓 / 納骨堂 のいずれか。',
    aliases: ['種別', '種類', 'タイプ', 'plottype', 'type'],
  },
  {
    key: 'status',
    label: '状態',
    required: false,
    hint: '空き / 予約済 / 使用中 / 墓じまい済。未指定なら「空き」になります。',
    aliases: ['ステータス', '区画状態', 'status'],
  },
  {
    key: 'contractDate',
    label: '契約日',
    required: false,
    hint: '西暦・和暦の暦日 (例: 2024-03-15 / 令和6年3月15日)。',
    aliases: ['契約年月日', '契約日付', 'contractdate', 'date'],
  },
  {
    key: 'contractPlan',
    label: '契約プラン',
    required: false,
    aliases: ['プラン', '区画プラン', 'contractplan', 'plan'],
  },
  {
    key: 'areaName',
    label: 'エリア名',
    required: false,
    hint: '配置先の墓地エリア名。既存エリアと一致すれば配置し、無ければ未配置で取り込みます。',
    aliases: ['エリア', '区域', '墓地エリア', 'area', 'areaname'],
  },
  {
    key: 'householderName',
    label: '契約世帯 (施主名)',
    required: false,
    hint: '契約者の施主名。既存世帯と一致すれば紐づけ、無ければ未契約として取り込みます。',
    aliases: ['契約者', '施主', '世帯', '世帯主', 'householder', 'householdername'],
  },
  {
    key: 'householderKana',
    label: '契約世帯 (ふりがな)',
    required: false,
    hint: '契約者の施主ふりがな。世帯の照合に用います。',
    aliases: ['施主かな', '世帯かな', '契約者かな', 'householderkana'],
  },
  {
    key: 'memo',
    label: '備考',
    required: false,
    aliases: ['メモ', '備考欄', '特記事項', 'note', 'memo', 'remarks'],
  },
];

const MAX_PLOT_NUMBER = 50;
const MAX_PLAN = 100;

function nullIfBlank(value: string): string | null {
  const t = value.trim();
  return t.length === 0 ? null : t;
}

/** 区画種別の表記ゆれ → enum。日本語ラベル・英語コードの双方を受ける。 */
const PLOT_TYPE_BY_LABEL: Record<string, GravePlotType> = {
  個人墓: 'INDIVIDUAL',
  個人: 'INDIVIDUAL',
  individual: 'INDIVIDUAL',
  夫婦墓: 'COUPLE',
  夫婦: 'COUPLE',
  couple: 'COUPLE',
  家族墓: 'FAMILY',
  家族: 'FAMILY',
  family: 'FAMILY',
  永代供養墓: 'ETERNAL_MEMORIAL',
  永代供養: 'ETERNAL_MEMORIAL',
  永代: 'ETERNAL_MEMORIAL',
  eternal_memorial: 'ETERNAL_MEMORIAL',
  納骨堂: 'OSSUARY',
  納骨: 'OSSUARY',
  ossuary: 'OSSUARY',
};

const STATUS_BY_LABEL: Record<string, GravePlotStatus> = {
  空き: 'AVAILABLE',
  空: 'AVAILABLE',
  空区画: 'AVAILABLE',
  available: 'AVAILABLE',
  予約済: 'RESERVED',
  予約: 'RESERVED',
  reserved: 'RESERVED',
  使用中: 'IN_USE',
  使用: 'IN_USE',
  in_use: 'IN_USE',
  墓じまい済: 'CLOSED',
  墓じまい: 'CLOSED',
  返還: 'CLOSED',
  closed: 'CLOSED',
  管理料滞納: 'OVERDUE',
  滞納: 'OVERDUE',
  overdue: 'OVERDUE',
  無縁化: 'UNCLAIMED',
  無縁: 'UNCLAIMED',
  unclaimed: 'UNCLAIMED',
  合祀済: 'INTERRED_TOGETHER',
  合祀: 'INTERRED_TOGETHER',
  interred_together: 'INTERRED_TOGETHER',
};

function normalizeEnumKey(raw: string): string {
  return raw.trim().toLowerCase();
}

export const gravePlotImportDef: EntityImportDef<
  GravePlotImportRecord,
  GravePlotExistingIndex
> = {
  id: 'grave-plot',
  label: '区画 (お墓)',
  description:
    '墓地区画台帳 (CSV / Excel) から区画を取り込みます。エリア名で墓地エリアへ、施主名で契約世帯へ紐づけます。既存と区画番号が重複する場合は警告し、確定時はスキップします。',
  columns: COLUMNS,

  toRecord(values, ctx) {
    const issues: RowIssue[] = [];

    const plotNumber = (values.plotNumber ?? '').trim();
    if (plotNumber.length === 0) {
      issues.push({ column: 'plotNumber', severity: 'error', message: '区画番号が未入力です。' });
    } else if (plotNumber.length > MAX_PLOT_NUMBER) {
      issues.push({
        column: 'plotNumber',
        severity: 'error',
        message: '区画番号が50文字を超えています。',
      });
    }

    const plotTypeRaw = (values.plotType ?? '').trim();
    let plotType: GravePlotType | null = null;
    if (plotTypeRaw.length === 0) {
      issues.push({ column: 'plotType', severity: 'error', message: '区画種別が未入力です。' });
    } else {
      const resolved = PLOT_TYPE_BY_LABEL[normalizeEnumKey(plotTypeRaw)];
      if (!resolved) {
        issues.push({
          column: 'plotType',
          severity: 'error',
          message: `区画種別「${plotTypeRaw}」を認識できません。個人墓/夫婦墓/家族墓/永代供養墓/納骨堂 のいずれかでご入力ください。`,
        });
      } else {
        plotType = resolved;
      }
    }

    const statusRaw = (values.status ?? '').trim();
    let status: GravePlotStatus = 'AVAILABLE';
    if (statusRaw.length > 0) {
      const resolved = STATUS_BY_LABEL[normalizeEnumKey(statusRaw)];
      if (!resolved) {
        issues.push({
          column: 'status',
          severity: 'error',
          message: `状態「${statusRaw}」を認識できません。空き/予約済/使用中/墓じまい済 のいずれかでご入力ください。`,
        });
      } else {
        status = resolved;
      }
    }

    let contractDate: Date | null = null;
    const parsedDate = parseDateCell(values.contractDate ?? '');
    if (!parsedDate.ok) {
      issues.push({
        column: 'contractDate',
        severity: 'error',
        message:
          parsedDate.error === 'incomplete_date'
            ? '契約日は年月日をすべてご入力ください (例: 2024-03-15)。'
            : parsedDate.error === 'invalid_calendar_date'
              ? '実在しない契約日です。'
              : '契約日の形式を読み取れませんでした。',
      });
    } else {
      contractDate = parsedDate.value;
    }

    const contractPlan = (values.contractPlan ?? '').trim();
    if (contractPlan.length > MAX_PLAN) {
      issues.push({
        column: 'contractPlan',
        severity: 'error',
        message: '契約プランが100文字を超えています。',
      });
    }

    // エリア解決 (名前一致)。未一致は警告のうえ未配置で取り込む。
    const areaName = (values.areaName ?? '').trim();
    let areaId: string | null = null;
    if (areaName.length > 0) {
      areaId = ctx.existing.areaIdByName(normalizeKana(areaName));
      if (areaId === null) {
        issues.push({
          column: 'areaName',
          severity: 'warning',
          message: `エリア「${areaName}」が見つかりません。未配置として取り込みます。`,
        });
      }
    }

    // 契約世帯解決 (施主名 or かな一致)。未一致は警告のうえ未契約で取り込む。
    const householderName = (values.householderName ?? '').trim();
    const householderKana = (values.householderKana ?? '').trim();
    let householdId: string | null = null;
    if (householderName.length > 0 || householderKana.length > 0) {
      const nameKey =
        householderName.length > 0 ? `name:${normalizeSecularName(householderName)}` : '';
      const kanaKey = householderKana.length > 0 ? `kana:${normalizeKana(householderKana)}` : '';
      householdId =
        (nameKey.length > 0 ? ctx.existing.householdIdByMatchKey(nameKey) : null) ??
        (kanaKey.length > 0 ? ctx.existing.householdIdByMatchKey(kanaKey) : null);
      if (householdId === null) {
        issues.push({
          column: 'householderName',
          severity: 'warning',
          message: `契約世帯「${householderName || householderKana}」が見つかりません。未契約として取り込みます。`,
        });
      }
    }

    // 区画番号の重複検出 (既存 DB)。warning → 確定時スキップ。
    let isDuplicate = false;
    if (plotNumber.length > 0 && ctx.existing.has(`plot:${plotNumber}`)) {
      isDuplicate = true;
      issues.push({
        column: 'plotNumber',
        severity: 'warning',
        message: '同じ区画番号が既に登録されています。確定時はスキップします。',
      });
    }

    const hasError = issues.some((i) => i.severity === 'error');
    if (hasError || isDuplicate || plotType === null) {
      return { issues, record: null };
    }

    const record: GravePlotImportRecord = {
      plotNumber,
      plotType,
      status,
      contractDate,
      contractPlan: nullIfBlank(contractPlan),
      areaId,
      householdId,
      memo: nullIfBlank(values.memo ?? ''),
    };
    return { issues, record };
  },

  async loadExistingKeys(tx, _tenantId): Promise<GravePlotExistingIndex> {
    // RLS により withTenant 配下では自テナントのみ見える。
    const [areas, households, plots] = await Promise.all([
      tx.gravePlotArea.findMany({ select: { id: true, name: true } }),
      tx.household.findMany({
        where: { isActive: true },
        select: { id: true, householderName: true, nameKana: true },
      }),
      tx.gravePlot.findMany({ select: { plotNumber: true } }),
    ]);

    const areaMap = new Map<string, string>();
    for (const a of areas) {
      const key = normalizeKana(a.name);
      if (key.length > 0 && !areaMap.has(key)) areaMap.set(key, a.id);
    }

    const householdMap = new Map<string, string>();
    for (const h of households) {
      const nk = normalizeSecularName(h.householderName);
      if (nk.length > 0 && !householdMap.has(`name:${nk}`)) householdMap.set(`name:${nk}`, h.id);
      const kk = normalizeKana(h.nameKana);
      if (kk.length > 0 && !householdMap.has(`kana:${kk}`)) householdMap.set(`kana:${kk}`, h.id);
    }

    const plotSet = new Set<string>();
    for (const p of plots) {
      plotSet.add(`plot:${p.plotNumber}`);
    }

    return {
      has: (key) => plotSet.has(key),
      areaIdByName: (key) => areaMap.get(key) ?? null,
      householdIdByMatchKey: (key) => householdMap.get(key) ?? null,
    };
  },

  async insertBatch(tx, tenantId, records): Promise<number> {
    // 同一ファイル内の区画番号重複は最初の 1 件のみ取り込む (@@unique 違反を未然に防ぐ)。
    const seen = new Set<string>();
    const data: Prisma.GravePlotCreateManyInput[] = [];
    for (const rec of records) {
      if (seen.has(rec.plotNumber)) continue;
      seen.add(rec.plotNumber);
      data.push({
        tenantId,
        plotNumber: rec.plotNumber,
        plotType: rec.plotType,
        status: rec.status,
        contractDate: rec.contractDate,
        contractPlan: rec.contractPlan,
        areaId: rec.areaId,
        householdId: rec.householdId,
        memo: rec.memo,
      });
    }
    if (data.length === 0) return 0;
    const result = await tx.gravePlot.createMany({ data });
    return result.count;
  },
};
