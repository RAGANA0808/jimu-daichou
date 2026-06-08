import type {
  GraveContractStatus,
  GraveContractType,
  GravePlotStatus,
  GravePlotType,
} from '@prisma/client';

export type GravePlotFieldName =
  | 'plotNumber'
  | 'plotType'
  | 'status'
  | 'householdId'
  | 'areaId'
  | 'contractDate'
  | 'contractPlan'
  | 'monumentName'
  | 'inscription'
  | 'memo';

export type GravePlotFormState = {
  status: 'idle' | 'error';
  errors?: Partial<Record<GravePlotFieldName, string>>;
  values?: Partial<Record<GravePlotFieldName, string>>;
};

export const initialGravePlotFormState: GravePlotFormState = {
  status: 'idle',
};

export const GRAVE_PLOT_TYPE_LABELS: Record<GravePlotType, string> = {
  INDIVIDUAL: '個人墓',
  COUPLE: '夫婦墓',
  FAMILY: '家族墓',
  ETERNAL_MEMORIAL: '永代供養墓',
  OSSUARY: '納骨堂',
};

export const GRAVE_PLOT_TYPE_ORDER: GravePlotType[] = [
  'INDIVIDUAL',
  'COUPLE',
  'FAMILY',
  'ETERNAL_MEMORIAL',
  'OSSUARY',
];

/** 区画種別の 1 文字略号 (地図タイルの密度向上用)。 */
export const GRAVE_PLOT_TYPE_SHORT: Record<GravePlotType, string> = {
  INDIVIDUAL: '個',
  COUPLE: '夫',
  FAMILY: '家',
  ETERNAL_MEMORIAL: '永',
  OSSUARY: '納',
};

export const GRAVE_PLOT_STATUS_LABELS: Record<GravePlotStatus, string> = {
  AVAILABLE: '空き',
  RESERVED: '予約済',
  IN_USE: '使用中',
  OVERDUE: '管理料滞納',
  UNCLAIMED: '無縁化',
  INTERRED_TOGETHER: '合祀済',
  CLOSED: '墓じまい済',
};

export const GRAVE_PLOT_STATUS_ORDER: GravePlotStatus[] = [
  'AVAILABLE',
  'RESERVED',
  'IN_USE',
  'OVERDUE',
  'UNCLAIMED',
  'INTERRED_TOGETHER',
  'CLOSED',
];

/**
 * 「実質的に空き (新規契約可能)」とみなす状態。空き区画検索 (G-7) の既定絞り込み。
 * CLOSED (墓じまい済) / 合祀済 等は再契約前提が異なるため空きに含めない。
 */
export const GRAVE_PLOT_VACANT_STATUSES: GravePlotStatus[] = ['AVAILABLE'];

/**
 * 地図タイル用の状態色 (枠+塗り+文字)。
 *
 * 【特許回避・配色制約】機能色とし、ブランド橙 (--brand) や せいざン の
 * ティール/シアンと混同しない別系統にする。滞納は danger(red)、無縁化は濃 slate、
 * 合祀済は indigo(藍)。color のみに依存させないため必ずラベルを併記すること。
 *
 * Tailwind JIT 対策: 完全な文字列リテラルで記述する (bg-${x}-50 のような動的合成は本番で無色化する)。
 */
export const GRAVE_PLOT_STATUS_TILE_CLASSES: Record<GravePlotStatus, string> = {
  AVAILABLE: 'bg-slate-50 border-slate-300 text-slate-600',
  RESERVED: 'bg-violet-50 border-violet-400 text-violet-800',
  IN_USE: 'bg-blue-50 border-blue-500 text-blue-800',
  OVERDUE: 'bg-red-50 border-red-500 text-red-800',
  UNCLAIMED: 'bg-slate-200 border-slate-600 text-slate-800',
  INTERRED_TOGETHER: 'bg-indigo-50 border-indigo-500 text-indigo-800',
  CLOSED: 'bg-slate-50 border-slate-300 border-dashed text-slate-400',
};

/** 凡例ドット / バッジ用 (塗りのみ)。同上 JIT 対策でリテラル記述。 */
export const GRAVE_PLOT_STATUS_DOT_CLASSES: Record<GravePlotStatus, string> = {
  AVAILABLE: 'bg-slate-300',
  RESERVED: 'bg-violet-400',
  IN_USE: 'bg-blue-500',
  OVERDUE: 'bg-red-500',
  UNCLAIMED: 'bg-slate-600',
  INTERRED_TOGETHER: 'bg-indigo-500',
  CLOSED: 'bg-slate-300',
};

// =========================================
// 区画契約 (GraveContract / G-4)
// =========================================

export type GraveContractFieldName =
  | 'contractType'
  | 'householdId'
  | 'startDate'
  | 'termYears'
  | 'status'
  | 'feeAmount'
  | 'memo';

export type GraveContractFormState = {
  status: 'idle' | 'error';
  errors?: Partial<Record<GraveContractFieldName, string>>;
  values?: Partial<Record<GraveContractFieldName, string>>;
};

export const initialGraveContractFormState: GraveContractFormState = {
  status: 'idle',
};

export const GRAVE_CONTRACT_TYPE_LABELS: Record<GraveContractType, string> = {
  ETERNAL_MEMORIAL: '永代供養',
  STANDARD: '通常使用',
  TEMPORARY: '一時預かり',
  OTHER: 'その他',
};

export const GRAVE_CONTRACT_TYPE_ORDER: GraveContractType[] = [
  'STANDARD',
  'ETERNAL_MEMORIAL',
  'TEMPORARY',
  'OTHER',
];

export const GRAVE_CONTRACT_STATUS_LABELS: Record<GraveContractStatus, string> =
  {
    ACTIVE: '契約中',
    EXPIRED: '満了',
    TERMINATED: '解約',
  };

export const GRAVE_CONTRACT_STATUS_ORDER: GraveContractStatus[] = [
  'ACTIVE',
  'EXPIRED',
  'TERMINATED',
];

// =========================================
// 納骨 (Burial)
// =========================================

export type BurialFormState = {
  status: 'idle' | 'error';
  errors?: Partial<Record<'personId' | 'interredAt' | 'memo', string>>;
  values?: Partial<Record<'personId' | 'interredAt' | 'memo', string>>;
};

export const initialBurialFormState: BurialFormState = { status: 'idle' };
