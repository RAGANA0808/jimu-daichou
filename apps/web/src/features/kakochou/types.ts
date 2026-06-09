export type DeathLedgerFieldName =
  | 'secularName'
  | 'nameKana'
  | 'kaimyoName'
  | 'deathYear'
  | 'deathMonth'
  | 'deathDay'
  | 'ageAtDeath'
  | 'familyRelation'
  | 'burialLocation'
  | 'memorialCutoffAnniversary'
  | 'memo';

export type DeathLedgerFormState = {
  status: 'idle' | 'error';
  errors?: Partial<Record<DeathLedgerFieldName, string>>;
  values?: Partial<Record<DeathLedgerFieldName, string>>;
  /**
   * 重複候補が見つかったときの警告 (登録を妨げない)。
   * ユーザーが確認のうえ `confirmDuplicate=true` で再送信すると登録を続行する。
   */
  duplicateWarning?: {
    names: string[];
  };
  /** 楽観ロック衝突など、フィールド非依存のエラー (M-5)。 */
  formError?: string;
};

export const initialDeathLedgerFormState: DeathLedgerFormState = {
  status: 'idle',
};
