'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import {
  initialMemorialServiceFormState,
  PREPARATION_STATUS_LABELS,
  PREPARATION_STATUS_ORDER,
  type MemorialServiceFieldName,
  type MemorialServiceFormState,
} from './types';

type MemorialServiceAction = (
  prev: MemorialServiceFormState,
  formData: FormData,
) => Promise<MemorialServiceFormState>;

type Props = {
  action: MemorialServiceAction;
  submitLabel: string;
  cancelHref: string;
  initialValues?: Partial<Record<MemorialServiceFieldName, string>>;
  /** 新規登録時に hidden 送信する世帯 ID */
  householdId?: string;
  /** 編集時に hidden 送信する法要 ID */
  memorialServiceId?: string;
};

type FieldProps = {
  name: MemorialServiceFieldName;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  state: MemorialServiceFormState;
  defaultValue?: string;
  inputMode?: 'numeric' | 'text';
  suffix?: string;
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
  suffix,
}: FieldProps) {
  const error = state.errors?.[name];
  const value = state.values?.[name] ?? defaultValue ?? '';
  return (
    <div className="space-y-1">
      <label htmlFor={name} className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-1 text-red-600">*</span>}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={name}
          name={name}
          type={type}
          required={required}
          defaultValue={value}
          placeholder={placeholder}
          inputMode={inputMode}
          aria-invalid={error ? 'true' : undefined}
          className="block w-full rounded border border-gray-300 px-3 py-2 text-base focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
        />
        {suffix && <span className="text-sm text-gray-600">{suffix}</span>}
      </div>
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
  name: MemorialServiceFieldName;
  label: string;
  state: MemorialServiceFormState;
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

function PreparationStatusField({
  state,
  defaultValue,
}: {
  state: MemorialServiceFormState;
  defaultValue?: string;
}) {
  const error = state.errors?.preparationStatus;
  const value = state.values?.preparationStatus ?? defaultValue ?? 'TENTATIVE';
  return (
    <div className="space-y-1">
      <label
        htmlFor="preparationStatus"
        className="block text-sm font-medium text-gray-700"
      >
        準備状況
      </label>
      <select
        id="preparationStatus"
        name="preparationStatus"
        defaultValue={value}
        aria-invalid={error ? 'true' : undefined}
        className="block w-full rounded border border-gray-300 px-3 py-2 text-base focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
      >
        {PREPARATION_STATUS_ORDER.map((s) => (
          <option key={s} value={s}>
            {PREPARATION_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}

export function MemorialServiceForm({
  action,
  submitLabel,
  cancelHref,
  initialValues,
  householdId,
  memorialServiceId,
}: Props) {
  const [state, formAction, isPending] = useActionState(
    action,
    initialMemorialServiceFormState,
  );
  const iv = initialValues ?? {};

  return (
    <form action={formAction} noValidate className="space-y-5">
      {householdId && (
        <input type="hidden" name="householdId" value={householdId} />
      )}
      {memorialServiceId && (
        <input
          type="hidden"
          name="memorialServiceId"
          value={memorialServiceId}
        />
      )}

      <TextField
        name="serviceName"
        label="法要名"
        required
        placeholder="例: 一周忌 / 盂蘭盆会 / 彼岸会"
        state={state}
        defaultValue={iv.serviceName}
      />
      <TextField
        name="scheduledAt"
        label="予定日時"
        type="datetime-local"
        required
        state={state}
        defaultValue={iv.scheduledAt}
      />
      <TextField
        name="location"
        label="場所"
        placeholder="例: 本堂 / 自宅"
        state={state}
        defaultValue={iv.location}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <TextField
          name="attendeeCount"
          label="参列人数"
          type="number"
          inputMode="numeric"
          placeholder="例: 8"
          state={state}
          defaultValue={iv.attendeeCount}
          suffix="人"
        />
        <TextField
          name="tobaCount"
          label="塔婆本数"
          type="number"
          inputMode="numeric"
          placeholder="例: 2"
          state={state}
          defaultValue={iv.tobaCount}
          suffix="本"
        />
        <TextField
          name="offeringAmount"
          label="御布施額"
          type="number"
          inputMode="numeric"
          placeholder="例: 30000"
          state={state}
          defaultValue={iv.offeringAmount}
          suffix="円"
        />
      </div>

      <PreparationStatusField
        state={state}
        defaultValue={iv.preparationStatus}
      />

      <TextareaField name="memo" label="備考メモ" state={state} defaultValue={iv.memo} />

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
