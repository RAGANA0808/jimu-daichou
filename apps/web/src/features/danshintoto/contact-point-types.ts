export type ContactPointFieldName =
  | 'relationLabel'
  | 'name'
  | 'phone'
  | 'mobile'
  | 'email'
  | 'postalCode'
  | 'address'
  | 'note';

export type ContactPointFormState = {
  status: 'idle' | 'error' | 'success';
  errors?: Partial<Record<ContactPointFieldName, string>>;
  values?: Partial<Record<ContactPointFieldName, string>>;
};

export const initialContactPointFormState: ContactPointFormState = {
  status: 'idle',
};

/** 続柄・役割のサジェスト候補 (datalist 用)。自由入力も残す。 */
export const CONTACT_RELATION_SUGGESTIONS = [
  '第2連絡先',
  '長男',
  '長女',
  '次男',
  '次女',
  '配偶者',
  '嫁ぎ先',
  '親戚',
  '知人',
  '成年後見人',
  '施設',
] as const;
