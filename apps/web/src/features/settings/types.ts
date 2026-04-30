export type TenantSettingsFieldName = 'name' | 'headPriestName';

export type TenantSettingsFormState = {
  status: 'idle' | 'error';
  errors?: Partial<Record<TenantSettingsFieldName, string>>;
  values?: Partial<Record<TenantSettingsFieldName, string>>;
};

export const initialTenantSettingsFormState: TenantSettingsFormState = {
  status: 'idle',
};
