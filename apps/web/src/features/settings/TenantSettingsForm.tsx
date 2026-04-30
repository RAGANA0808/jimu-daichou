'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { updateTenantSettingsAction } from './actions';
import {
  initialTenantSettingsFormState,
  type TenantSettingsFieldName,
  type TenantSettingsFormState,
} from './types';

type FieldProps = {
  name: TenantSettingsFieldName;
  label: string;
  required?: boolean;
  placeholder?: string;
  state: TenantSettingsFormState;
  defaultValue?: string;
  description?: string;
};

function TextField({
  name,
  label,
  required,
  placeholder,
  state,
  defaultValue,
  description,
}: FieldProps) {
  const error = state.errors?.[name];
  const value = state.values?.[name] ?? defaultValue ?? '';
  return (
    <div className="space-y-1">
      <label htmlFor={name} className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-1 text-red-600">*</span>}
      </label>
      {description && (
        <p className="text-xs text-gray-500">{description}</p>
      )}
      <input
        id={name}
        name={name}
        type="text"
        required={required}
        defaultValue={value}
        placeholder={placeholder}
        aria-invalid={error ? 'true' : undefined}
        className="block w-full rounded border border-gray-300 px-3 py-2 text-base focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
      />
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}

type Props = {
  initialValues: Record<TenantSettingsFieldName, string>;
};

export function TenantSettingsForm({ initialValues }: Props) {
  const [state, formAction, isPending] = useActionState(
    updateTenantSettingsAction,
    initialTenantSettingsFormState,
  );

  return (
    <form action={formAction} noValidate className="space-y-5">
      <TextField
        name="name"
        label="寺院名"
        required
        placeholder="例: 芳全寺"
        description="ダッシュボード・案内状 PDF 等で表示されます。"
        state={state}
        defaultValue={initialValues.name}
      />
      <TextField
        name="headPriestName"
        label="住職氏名"
        placeholder="例: 山田 太郎"
        description="案内状 PDF の署名欄に「住職 〇〇 〇〇」として表示されます。未設定なら表示されません。"
        state={state}
        defaultValue={initialValues.headPriestName}
      />

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-gray-900 px-4 py-2 text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          {isPending ? '保存中…' : '保存する'}
        </button>
        <Link
          href="/settings"
          className="rounded border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-100"
        >
          キャンセル
        </Link>
      </div>
    </form>
  );
}
