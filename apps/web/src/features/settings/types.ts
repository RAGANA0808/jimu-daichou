export type TenantSettingsFieldName = 'name' | 'headPriestName' | 'sect';

export type TenantSettingsFormState = {
  status: 'idle' | 'error';
  errors?: Partial<Record<TenantSettingsFieldName, string>>;
  values?: Partial<Record<TenantSettingsFieldName, string>>;
};

export const initialTenantSettingsFormState: TenantSettingsFormState = {
  status: 'idle',
};

export type SetupFieldName =
  | 'name'
  | 'headPriestName'
  | 'sect'
  | 'postalAccountName'
  | 'postalAccountSymbol'
  | 'postalAccountNumber'
  | 'postalTransferNote';

export type SetupFormState = {
  status: 'idle' | 'error';
  errors?: Partial<Record<SetupFieldName, string>>;
  values?: Partial<Record<SetupFieldName, string>>;
  /** 段階横断のサーバー失敗メッセージ。 */
  formError?: string;
};

export const initialSetupFormState: SetupFormState = { status: 'idle' };
