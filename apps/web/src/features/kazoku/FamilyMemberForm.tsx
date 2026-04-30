'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import {
  FAMILY_RELATION_SUGGESTIONS,
  initialFamilyMemberFormState,
  type FamilyMemberFieldName,
  type FamilyMemberFormState,
} from './types';

type FamilyMemberAction = (
  prev: FamilyMemberFormState,
  formData: FormData,
) => Promise<FamilyMemberFormState>;

type Props = {
  action: FamilyMemberAction;
  submitLabel: string;
  cancelHref: string;
  initialValues?: Partial<Record<FamilyMemberFieldName, string>>;
  /** 新規登録時に hidden 送信する世帯 ID */
  householdId?: string;
  /** 編集時に hidden 送信する Person ID */
  personId?: string;
};

type FieldProps = {
  name: FamilyMemberFieldName;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  state: FamilyMemberFormState;
  defaultValue?: string;
  list?: string;
};

function TextField({
  name,
  label,
  type = 'text',
  required,
  placeholder,
  state,
  defaultValue,
  list,
}: FieldProps) {
  const error = state.errors?.[name];
  const value = state.values?.[name] ?? defaultValue ?? '';
  return (
    <div className="space-y-1">
      <label htmlFor={name} className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-1 text-red-600">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        defaultValue={value}
        placeholder={placeholder}
        list={list}
        aria-invalid={error ? 'true' : undefined}
        className="block w-full rounded border border-gray-300 px-3 py-2 text-base focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
      />
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}

export function FamilyMemberForm({
  action,
  submitLabel,
  cancelHref,
  initialValues,
  householdId,
  personId,
}: Props) {
  const [state, formAction, isPending] = useActionState(
    action,
    initialFamilyMemberFormState,
  );
  const iv = initialValues ?? {};

  return (
    <form action={formAction} noValidate className="space-y-5">
      {householdId && (
        <input type="hidden" name="householdId" value={householdId} />
      )}
      {personId && <input type="hidden" name="personId" value={personId} />}

      <TextField
        name="name"
        label="氏名"
        required
        placeholder="例: 山田 花子"
        state={state}
        defaultValue={iv.name}
      />
      <TextField
        name="nameKana"
        label="ふりがな"
        required
        placeholder="例: やまだ はなこ"
        state={state}
        defaultValue={iv.nameKana}
      />
      <TextField
        name="familyRelation"
        label="続柄"
        placeholder="例: 配偶者 / 長男"
        state={state}
        defaultValue={iv.familyRelation}
        list="family-relation-suggestions"
      />
      <datalist id="family-relation-suggestions">
        {FAMILY_RELATION_SUGGESTIONS.map((rel) => (
          <option key={rel} value={rel} />
        ))}
      </datalist>

      <TextField
        name="birthDate"
        label="生年月日"
        type="date"
        state={state}
        defaultValue={iv.birthDate}
      />

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-gray-900 px-4 py-2 text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          {isPending ? '保存中…' : submitLabel}
        </button>
        <Link
          href={cancelHref}
          className="rounded border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-100"
        >
          キャンセル
        </Link>
      </div>
    </form>
  );
}
