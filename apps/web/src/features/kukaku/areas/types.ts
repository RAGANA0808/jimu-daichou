export type GravePlotAreaFieldName =
  | 'name'
  | 'sortOrder'
  | 'canvasWidth'
  | 'canvasHeight';

export type GravePlotAreaFormState = {
  status: 'idle' | 'error';
  errors?: Partial<Record<GravePlotAreaFieldName, string>>;
  values?: Partial<Record<GravePlotAreaFieldName, string>>;
};

export const initialGravePlotAreaFormState: GravePlotAreaFormState = {
  status: 'idle',
};

export const GRAVE_PLOT_AREA_CANVAS_MIN = 400;
export const GRAVE_PLOT_AREA_CANVAS_MAX = 4000;
