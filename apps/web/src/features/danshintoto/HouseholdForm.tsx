'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { VoiceTextarea } from '@/components/ui';
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
  /** M-5 楽観ロックトークン (編集時のみ)。hidden input として送出される。 */
  expectedUpdatedAt?: string;
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
      <label htmlFor={name} className="block text-sm font-medium text-foreground">
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
        className="block w-full rounded border border-border px-3 py-2 text-base focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
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
      <label htmlFor={name} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      <VoiceTextarea
        id={name}
        name={name}
        rows={3}
        defaultValue={value}
        aria-invalid={error ? 'true' : undefined}
        voiceFieldLabel="備考メモ"
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
  expectedUpdatedAt,
}: Props) {
  const [state, formAction, isPending] = useActionState(
    action,
    initialHouseholdFormState,
  );

  const iv = initialValues ?? {};

  return (
    <form action={formAction} noValidate className="space-y-5">
      {householdId && <input type="hidden" name="id" value={householdId} />}
      {expectedUpdatedAt && (
        <input
          type="hidden"
          name="expectedUpdatedAt"
          value={expectedUpdatedAt}
        />
      )}

      {state.formError && (
        <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.formError}
        </p>
      )}

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

      <p className="rounded border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        第 2 連絡先・ご親族などの連絡先は、登録後にカルテ詳細の「連絡先」から
        ご家族ごとに追加・並べ替えができます。
      </p>

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
          className="inline-flex min-h-touch items-center rounded bg-brand px-4 py-2 font-medium text-brand-foreground transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? '保存中…' : submitLabel}
        </button>
        <Link
          href={cancelHref}
          className="rounded border border-border px-4 py-2 text-foreground hover:bg-muted"
        >
          キャンセル
        </Link>
      </div>
    </form>
  );
}
