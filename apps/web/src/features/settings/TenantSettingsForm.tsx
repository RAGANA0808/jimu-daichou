'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { SECT_OPTIONS } from '@/lib/nenki';
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
      <label htmlFor={name} className="block text-sm font-medium text-foreground">
        {label}
        {required && <span className="ml-1 text-red-600">*</span>}
      </label>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      <input
        id={name}
        name={name}
        type="text"
        required={required}
        defaultValue={value}
        placeholder={placeholder}
        aria-invalid={error ? 'true' : undefined}
        className="block w-full rounded border border-border px-3 py-2 text-base focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
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

      <div className="space-y-1">
        <label
          htmlFor="sect"
          className="block text-sm font-medium text-foreground"
        >
          宗派
        </label>
        <p className="text-xs text-muted-foreground">
          年忌の弔い上げの目安に使われます。浄土真宗系では三十三回忌が既定の目安になります。
          （故人ごとの弔い上げ設定が常に優先されます）
        </p>
        <select
          id="sect"
          name="sect"
          defaultValue={state.values?.sect ?? initialValues.sect}
          className="block w-full rounded border border-border px-3 py-2 text-base focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        >
          <option value="">未設定（標準・五十回忌まで）</option>
          {SECT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {state.errors?.sect && (
          <p className="text-sm text-red-700">{state.errors.sect}</p>
        )}
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex min-h-touch items-center rounded bg-brand px-4 py-2 font-medium text-brand-foreground transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? '保存中…' : '保存する'}
        </button>
        <Link
          href="/settings"
          className="rounded border border-border px-4 py-2 text-foreground hover:bg-muted"
        >
          キャンセル
        </Link>
      </div>
    </form>
  );
}
