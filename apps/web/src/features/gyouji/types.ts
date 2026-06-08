export type TempleEventFieldName =
  | 'title'
  | 'scheduledAt'
  | 'endTime'
  | 'location'
  | 'memo';

export type TempleEventFormState = {
  status: 'idle' | 'error';
  errors?: Partial<Record<TempleEventFieldName, string>>;
  values?: Partial<Record<TempleEventFieldName, string>>;
  /** 楽観ロック衝突など、フィールド非依存のエラー。 */
  formError?: string;
};

export const initialTempleEventFormState: TempleEventFormState = {
  status: 'idle',
};
