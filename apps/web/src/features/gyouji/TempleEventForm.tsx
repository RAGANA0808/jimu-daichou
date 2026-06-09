'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { VoiceTextarea } from '@/components/ui';
import {
  initialTempleEventFormState,
  type TempleEventFieldName,
  type TempleEventFormState,
} from './types';

type TempleEventAction = (
  prev: TempleEventFormState,
  formData: FormData,
) => Promise<TempleEventFormState>;

type Props = {
  action: TempleEventAction;
  submitLabel: string;
  cancelHref: string;
  initialValues?: Partial<Record<TempleEventFieldName, string>>;
  /** 編集時に hidden 送信する寺行事 ID */
  templeEventId?: string;
};

type FieldProps = {
  name: TempleEventFieldName;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  state: TempleEventFormState;
  defaultValue?: string;
};

function TextField({
  name,
  label,
  type = 'text',
  required,
  placeholder,
  state,
  defaultValue,
}: FieldProps) {
  const error = state.errors?.[name];
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
        aria-invalid={error ? 'true' : undefined}
        className="block w-full rounded border border-border px-3 py-2 text-base focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
      />
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}

export function TempleEventForm({
  action,
  submitLabel,
  cancelHref,
  initialValues,
  templeEventId,
}: Props) {
  const [state, formAction, isPending] = useActionState(
    action,
    initialTempleEventFormState,
  );
  const iv = initialValues ?? {};
  const memoError = state.errors?.memo;
  const memoValue = state.values?.memo ?? iv.memo ?? '';

  return (
    <form action={formAction} noValidate className="space-y-5">
      {templeEventId && (
        <input type="hidden" name="templeEventId" value={templeEventId} />
      )}

      {state.formError && (
        <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.formError}
        </p>
      )}

      <TextField
        name="title"
        label="行事名"
        required
        placeholder="例: 盂蘭盆会 / 彼岸会 / 除夜の鐘"
        state={state}
        defaultValue={iv.title}
      />
      <TextField
        name="scheduledAt"
        label="予定日時"
        type="datetime-local"
        required
        state={state}
        defaultValue={iv.scheduledAt}
      />
      <div className="space-y-1">
        <TextField
          name="endTime"
          label="終了予定時刻"
          type="datetime-local"
          state={state}
          defaultValue={iv.endTime}
        />
        <p className="text-xs text-muted-foreground">
          空欄の場合は、カレンダー連携時に約 1 時間で登録します。
        </p>
      </div>
      <TextField
        name="location"
        label="場所"
        placeholder="例: 本堂 / 境内"
        state={state}
        defaultValue={iv.location}
      />

      <div className="space-y-1">
        <label
          htmlFor="memo"
          className="block text-sm font-medium text-foreground"
        >
          備考メモ
        </label>
        <VoiceTextarea
          id="memo"
          name="memo"
          rows={3}
          defaultValue={memoValue}
          aria-invalid={memoError ? 'true' : undefined}
          voiceFieldLabel="備考メモ"
        />
        {memoError && <p className="text-sm text-red-700">{memoError}</p>}
      </div>

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
