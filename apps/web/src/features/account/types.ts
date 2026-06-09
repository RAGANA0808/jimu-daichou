export type AccountProfileFieldName = 'displayName';

export type AccountProfileFormState = {
  status: 'idle' | 'error';
  errors?: Partial<Record<AccountProfileFieldName, string>>;
  values?: Partial<Record<AccountProfileFieldName, string>>;
};

export const initialAccountProfileFormState: AccountProfileFormState = {
  status: 'idle',
};

export const DISPLAY_NAME_MAX_LENGTH = 50;
