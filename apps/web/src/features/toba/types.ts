export type TobaFieldName =
  | 'applicantName'
  | 'targetPersonId'
  | 'count'
  | 'inscription'
  | 'offeringAmount'
  | 'memo';

export type TobaFormState = {
  status: 'idle' | 'error';
  errors?: Partial<Record<TobaFieldName, string>>;
  values?: Partial<Record<TobaFieldName, string>>;
};

export const initialTobaFormState: TobaFormState = {
  status: 'idle',
};
