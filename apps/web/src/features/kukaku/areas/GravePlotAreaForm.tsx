'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import {
  initialGravePlotAreaFormState,
  type GravePlotAreaFieldName,
  type GravePlotAreaFormState,
} from './types';

type AreaAction = (
  prev: GravePlotAreaFormState,
  formData: FormData,
) => Promise<GravePlotAreaFormState>;

type Props = {
  action: AreaAction;
  submitLabel: string;
  cancelHref: string;
  gravePlotAreaId?: string;
  initialValues?: Partial<Record<GravePlotAreaFieldName, string>>;
};

type FieldProps = {
  name: GravePlotAreaFieldName;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  state: GravePlotAreaFormState;
  defaultValue?: string;
};

function TextField({
  name,
  label,
  type = 'text',
  required,
  placeholder,
  helpText,
  state,
  defaultValue,
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
        inputMode={type === 'number' ? 'numeric' : undefined}
        aria-invalid={error ? 'true' : undefined}
        className="block w-full rounded border border-gray-300 px-3 py-2 text-base focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
      />
      {helpText && !error && (
        <p className="text-xs text-gray-500">{helpText}</p>
      )}
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}

export function GravePlotAreaForm({
  action,
  submitLabel,
  cancelHref,
  gravePlotAreaId,
  initialValues,
}: Props) {
  const [state, formAction, isPending] = useActionState(
    action,
    initialGravePlotAreaFormState,
  );
  const iv = initialValues ?? {};

  return (
    <form action={formAction} noValidate className="space-y-5">
      {gravePlotAreaId && (
        <input type="hidden" name="gravePlotAreaId" value={gravePlotAreaId} />
      )}

      <TextField
        name="name"
        label="エリア名"
        required
        placeholder="例: 東墓地 / 西墓地 / 永代供養区"
        state={state}
        defaultValue={iv.name}
      />

      <TextField
        name="sortOrder"
        label="表示順"
        type="number"
        placeholder="例: 10"
        helpText="地図のタブの並び順 (小さい値ほど左)。同値は作成日順。"
        state={state}
        defaultValue={iv.sortOrder}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          name="canvasWidth"
          label="キャンバス幅 (px)"
          type="number"
          placeholder="1200"
          helpText="初期値 1200"
          state={state}
          defaultValue={iv.canvasWidth}
        />
        <TextField
          name="canvasHeight"
          label="キャンバス高さ (px)"
          type="number"
          placeholder="800"
          helpText="初期値 800"
          state={state}
          defaultValue={iv.canvasHeight}
        />
      </div>

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
