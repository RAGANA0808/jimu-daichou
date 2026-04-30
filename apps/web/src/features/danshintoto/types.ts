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
};

export const initialHouseholdFormState: HouseholdFormState = { status: 'idle' };
