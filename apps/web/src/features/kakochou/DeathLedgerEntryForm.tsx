'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import {
  initialDeathLedgerFormState,
  type DeathLedgerFieldName,
  type DeathLedgerFormState,
} from './types';

type DeathLedgerAction = (
  prev: DeathLedgerFormState,
  formData: FormData,
) => Promise<DeathLedgerFormState>;

type FieldProps = {
  name: DeathLedgerFieldName;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  state: DeathLedgerFormState;
  defaultValue?: string;
  inputMode?: 'numeric' | 'text';
  max?: string;
};

function TextField({
  name,
  label,
  type = 'text',
  required,
  placeholder,
  state,
  defaultValue,
  inputMode,
  max,
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
        inputMode={inputMode}
        max={max}
        aria-invalid={error ? 'true' : undefined}
        className="block w-full rounded border border-gray-300 px-3 py-2 text-base focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
      />
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}

function TextareaField({
  name,
  label,
  state,
  defaultValue,
}: {
  name: DeathLedgerFieldName;
  label: string;
  state: DeathLedgerFormState;
  defaultValue?: string;
}) {
  const error = state.errors?.[name];
  const value = state.values?.[name] ?? defaultValue ?? '';
  return (
    <div className="space-y-1">
      <label htmlFor={name} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <textarea
        id={name}
        name={name}
        rows={3}
        defaultValue={value}
        aria-invalid={error ? 'true' : undefined}
        className="block w-full rounded border border-gray-300 px-3 py-2 text-base focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
      />
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}

type Props = {
  action: DeathLedgerAction;
  submitLabel: string;
  cancelHref: string;
  initialValues?: Partial<Record<DeathLedgerFieldName, string>>;
  /** 新規登録時に hidden で送信する世帯 ID */
  householdId?: string;
  /** 編集時に hidden で送信するエントリ ID */
  entryId?: string;
};

export function DeathLedgerEntryForm({
  action,
  submitLabel,
  cancelHref,
  initialValues,
  householdId,
  entryId,
}: Props) {
  const [state, formAction, isPending] = useActionState(
    action,
    initialDeathLedgerFormState,
  );

  const todayIso = new Date().toISOString().slice(0, 10);
  const iv = initialValues ?? {};

  return (
    <form action={formAction} noValidate className="space-y-5">
      {householdId && (
        <input type="hidden" name="householdId" value={householdId} />
      )}
      {entryId && <input type="hidden" name="entryId" value={entryId} />}

      <TextField
        name="secularName"
        label="俗名"
        required
        placeholder="例: 山田 一郎"
        state={state}
        defaultValue={iv.secularName}
      />
      <TextField
        name="nameKana"
        label="ふりがな"
        required
        placeholder="例: やまだ いちろう"
        state={state}
        defaultValue={iv.nameKana}
      />
      <TextField
        name="kaimyoName"
        label="戒名"
        placeholder="例: 釈○○"
        state={state}
        defaultValue={iv.kaimyoName}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_120px]">
        <TextField
          name="dateOfDeath"
          label="没年月日"
          type="date"
          required
          max={todayIso}
          state={state}
          defaultValue={iv.dateOfDeath}
        />
        <TextField
          name="ageAtDeath"
          label="行年"
          type="number"
          inputMode="numeric"
          placeholder="例: 85"
          state={state}
          defaultValue={iv.ageAtDeath}
        />
      </div>

      <TextField
        name="familyRelation"
        label="続柄"
        placeholder="例: 先代 / 父 / 母"
        state={state}
        defaultValue={iv.familyRelation}
      />
      <TextField
        name="burialLocation"
        label="埋葬場所"
        placeholder="例: ○○霊園"
        state={state}
        defaultValue={iv.burialLocation}
      />
      <TextareaField
        name="memo"
        label="備考メモ"
        state={state}
        defaultValue={iv.memo}
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
