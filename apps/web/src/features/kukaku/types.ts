import type { GravePlotStatus, GravePlotType } from '@prisma/client';

export type GravePlotFieldName =
  | 'plotNumber'
  | 'plotType'
  | 'status'
  | 'householdId'
  | 'areaId'
  | 'contractDate'
  | 'contractPlan'
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

export const GRAVE_PLOT_STATUS_LABELS: Record<GravePlotStatus, string> = {
  AVAILABLE: '空き',
  RESERVED: '予約済',
  IN_USE: '使用中',
  CLOSED: '墓じまい済',
};

export const GRAVE_PLOT_STATUS_ORDER: GravePlotStatus[] = [
  'AVAILABLE',
  'RESERVED',
  'IN_USE',
  'CLOSED',
];
