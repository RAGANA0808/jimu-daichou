export type DeathLedgerFieldName =
  | 'secularName'
  | 'nameKana'
  | 'kaimyoName'
  | 'dateOfDeath'
  | 'ageAtDeath'
  | 'familyRelation'
  | 'burialLocation'
  | 'memo';

export type DeathLedgerFormState = {
  status: 'idle' | 'error';
  errors?: Partial<Record<DeathLedgerFieldName, string>>;
  values?: Partial<Record<DeathLedgerFieldName, string>>;
};

export const initialDeathLedgerFormState: DeathLedgerFormState = {
  status: 'idle',
};
