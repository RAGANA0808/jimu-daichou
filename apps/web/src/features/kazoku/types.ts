export type FamilyMemberFieldName =
  | 'name'
  | 'nameKana'
  | 'familyRelation'
  | 'birthDate';

export type FamilyMemberFormState = {
  status: 'idle' | 'error';
  errors?: Partial<Record<FamilyMemberFieldName, string>>;
  values?: Partial<Record<FamilyMemberFieldName, string>>;
};

export const initialFamilyMemberFormState: FamilyMemberFormState = {
  status: 'idle',
};

/**
 * 続柄 (familyRelation) の候補値。フォームでは datalist で提案し、
 * 自由入力も許可する (稀な続柄に対応するため)。
 */
export const FAMILY_RELATION_SUGGESTIONS = [
  '配偶者',
  '父',
  '母',
  '祖父',
  '祖母',
  '長男',
  '長女',
  '次男',
  '次女',
  '三男',
  '三女',
  '兄',
  '姉',
  '弟',
  '妹',
  '義父',
  '義母',
  '孫',
] as const;
