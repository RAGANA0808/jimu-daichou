'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import {
  initialHouseholdFormState,
  type HouseholdFieldName,
  type HouseholdFormState,
} from './types';

type HouseholdAction = (
  prev: HouseholdFormState,
  formData: FormData,
) => Promise<HouseholdFormState>;

type Props = {
  action: HouseholdAction;
  initialValues?: Partial<Record<HouseholdFieldName, string>>;
  submitLabel: string;
  /** 編集時のみ設定。hidden input として送出される。 */
  householdId?: string;
  /** キャンセル時の戻り先。編集ならその世帯の詳細、登録なら一覧。 */
  cancelHref: string;
};

type FieldProps = {
  name: HouseholdFieldName;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  state: HouseholdFormState;
  defaultValue?: string;
  autoComplete?: string;
};

function TextField({
  name,
  label,
  type = 'text',
  required,
  placeholder,
  state,
  defaultValue,
  autoComplete,
}: FieldProps) {
  const error = state.errors?.[name];
  // フォーム再送時はサーバーから返った values を優先、なければ DB 初期値
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
        autoComplete={autoComplete}
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
  name: HouseholdFieldName;
  label: string;
  state: HouseholdFormState;
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

export function HouseholdForm({
  action,
  initialValues,
  submitLabel,
  householdId,
  cancelHref,
}: Props) {
  const [state, formAction, isPending] = useActionState(
    action,
    initialHouseholdFormState,
  );

  const iv = initialValues ?? {};

  return (
    <form action={formAction} noValidate className="space-y-5">
      {householdId && <input type="hidden" name="id" value={householdId} />}

      <TextField
        name="householderName"
        label="施主名"
        required
        placeholder="例: 山田 太郎"
        state={state}
        defaultValue={iv.householderName}
        autoComplete="off"
      />
      <TextField
        name="nameKana"
        label="ふりがな (検索用)"
        required
        placeholder="例: やまだ たろう"
        state={state}
        defaultValue={iv.nameKana}
        autoComplete="off"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          name="phone"
          label="電話"
          type="tel"
          placeholder="例: 03-1234-5678"
          state={state}
          defaultValue={iv.phone}
          autoComplete="tel"
        />
        <TextField
          name="mobile"
          label="携帯電話"
          type="tel"
          placeholder="例: 090-1234-5678"
          state={state}
          defaultValue={iv.mobile}
          autoComplete="tel"
        />
      </div>

      <TextField
        name="email"
        label="メール"
        type="email"
        placeholder="例: taro@example.com"
        state={state}
        defaultValue={iv.email}
        autoComplete="email"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[140px_1fr]">
        <TextField
          name="postalCode"
          label="郵便番号"
          placeholder="例: 123-4567"
          state={state}
          defaultValue={iv.postalCode}
          autoComplete="postal-code"
        />
        <TextField
          name="address"
          label="住所"
          placeholder="例: 東京都○○区○○ 1-2-3"
          state={state}
          defaultValue={iv.address}
          autoComplete="street-address"
        />
      </div>

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
