import type { BadgeProps } from '@/components/ui';
import type {
  CircuitStopStatus,
  CircuitTourStatus,
  CircuitTourType,
} from '@prisma/client';

export type TourFieldName =
  | 'title'
  | 'tourType'
  | 'scheduledDate'
  | 'assignedUserId'
  | 'memo';

export type TourFormState = {
  status: 'idle' | 'error' | 'success';
  errors?: Partial<Record<TourFieldName, string>>;
  values?: Partial<Record<TourFieldName, string>>;
  /** フィールド非依存のエラー。 */
  formError?: string;
};

export const initialTourFormState: TourFormState = { status: 'idle' };

export type StopFieldName = 'householdId' | 'gravePlotId' | 'visitLabel' | 'memo';

export type StopFormState = {
  status: 'idle' | 'error' | 'success';
  errors?: Partial<Record<StopFieldName, string>>;
  values?: Partial<Record<StopFieldName, string>>;
  /** フィールド非依存のエラー。 */
  formError?: string;
};

export const initialStopFormState: StopFormState = { status: 'idle' };

// ---- UI 表示ラベル (日本語) ----
// enum 値は @prisma/client から型 import し、ラベルだけをここに集約する。

/** 巡回種別の表示ラベル。 */
export const CIRCUIT_TOUR_TYPE_LABELS: Record<CircuitTourType, string> = {
  TANAGYO: '棚経',
  TSUKIMAIRI: '月参り',
  OTHER: 'その他',
};

/** 巡回状況の表示ラベル。 */
export const CIRCUIT_TOUR_STATUS_LABELS: Record<CircuitTourStatus, string> = {
  PLANNED: '予定',
  DONE: '実施済み',
  CANCELED: '中止',
};

/** 訪問先状況の表示ラベル。 */
export const CIRCUIT_STOP_STATUS_LABELS: Record<CircuitStopStatus, string> = {
  PENDING: '未訪問',
  VISITED: '訪問済み',
  SKIPPED: '不在・見送り',
};

/** 巡回状況のバッジ variant (houyou の STATUS_BADGE_VARIANT 方式)。 */
export const CIRCUIT_TOUR_STATUS_BADGE_VARIANT: Record<
  CircuitTourStatus,
  BadgeProps['variant']
> = {
  PLANNED: 'info',
  DONE: 'success',
  CANCELED: 'danger',
};

/** 訪問先状況のバッジ variant。 */
export const CIRCUIT_STOP_STATUS_BADGE_VARIANT: Record<
  CircuitStopStatus,
  BadgeProps['variant']
> = {
  PENDING: 'neutral',
  VISITED: 'success',
  SKIPPED: 'warning',
};

/** フォーム select 列挙用の巡回種別の順序付き定義。 */
export const CIRCUIT_TOUR_TYPE_OPTIONS: ReadonlyArray<{
  value: CircuitTourType;
  label: string;
}> = [
  { value: 'TANAGYO', label: CIRCUIT_TOUR_TYPE_LABELS.TANAGYO },
  { value: 'TSUKIMAIRI', label: CIRCUIT_TOUR_TYPE_LABELS.TSUKIMAIRI },
  { value: 'OTHER', label: CIRCUIT_TOUR_TYPE_LABELS.OTHER },
];
