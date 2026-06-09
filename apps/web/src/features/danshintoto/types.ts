export type HouseholdFieldName =
  | 'householderName'
  | 'nameKana'
  | 'postalCode'
  | 'address'
  | 'phone'
  | 'mobile'
  | 'email'
  | 'memo';

export type HouseholdFormState = {
  status: 'idle' | 'error';
  errors?: Partial<Record<HouseholdFieldName, string>>;
  values?: Partial<Record<HouseholdFieldName, string>>;
  /** 楽観ロック衝突など、フィールド非依存のエラー (M-5)。 */
  formError?: string;
};

export const initialHouseholdFormState: HouseholdFormState = { status: 'idle' };
