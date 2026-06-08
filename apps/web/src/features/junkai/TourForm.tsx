'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useRef } from 'react';
import { Select, VoiceTextarea } from '@/components/ui';
import type { AssigneeOption } from './queries';
import {
  CIRCUIT_TOUR_TYPE_OPTIONS,
  initialTourFormState,
  type TourFieldName,
  type TourFormState,
} from './types';

type TourAction = (
  prev: TourFormState,
  formData: FormData,
) => Promise<TourFormState>;

type Props = {
  action: TourAction;
  submitLabel: string;
  cancelHref: string;
  /** 成功後に遷移する先 (登録は一覧、編集は詳細など)。 */
  redirectTo: string;
  initialValues?: Partial<Record<TourFieldName, string>>;
  /** 編集時に hidden 送信する巡回 ID */
  circuitTourId?: string;
  assignedUserOptions: AssigneeOption[];
};

type FieldProps = {
  name: TourFieldName;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  maxLength?: number;
  state: TourFormState;
  defaultValue?: string;
};

function TextField({
  name,
  label,
  type = 'text',
  required,
  placeholder,
  maxLength,
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
        maxLength={maxLength}
        defaultValue={value}
        placeholder={placeholder}
        aria-invalid={error ? 'true' : undefined}
        className="block w-full rounded border border-border px-3 py-2 text-base focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
      />
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}

export function TourForm({
  action,
  submitLabel,
  cancelHref,
  redirectTo,
  initialValues,
  circuitTourId,
  assignedUserOptions,
}: Props) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    action,
    initialTourFormState,
  );
  const iv = initialValues ?? {};

  // Server Action は redirect ではなく { status: 'success' } を返す流儀のため
  // (contact-point と統一)、成功検知してクライアント側で遷移する。
  const redirectRef = useRef(redirectTo);
  redirectRef.current = redirectTo;
  useEffect(() => {
    if (state.status === 'success') {
      router.push(redirectRef.current);
      router.refresh();
    }
  }, [state.status, router]);

  const tourTypeError = state.errors?.tourType;
  const tourTypeValue =
    state.values?.tourType ?? iv.tourType ?? 'TANAGYO';
  const assigneeValue = state.values?.assignedUserId ?? iv.assignedUserId ?? '';
  const memoError = state.errors?.memo;
  const memoValue = state.values?.memo ?? iv.memo ?? '';

  return (
    <form action={formAction} noValidate className="space-y-5">
      {circuitTourId && (
        <input type="hidden" name="circuitTourId" value={circuitTourId} />
      )}

      {state.formError && (
        <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.formError}
        </p>
      )}

      <TextField
        name="title"
        label="巡回名"
        required
        maxLength={60}
        placeholder="例: 8月 棚経 / 毎月 月参り"
        state={state}
        defaultValue={iv.title}
      />

      <div className="space-y-1">
        <label
          htmlFor="tourType"
          className="block text-sm font-medium text-foreground"
        >
          種別
          <span className="ml-1 text-red-600">*</span>
        </label>
        <Select
          id="tourType"
          name="tourType"
          defaultValue={tourTypeValue}
          aria-invalid={tourTypeError ? 'true' : undefined}
        >
          {CIRCUIT_TOUR_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        {tourTypeError && <p className="text-sm text-red-700">{tourTypeError}</p>}
      </div>

      <TextField
        name="scheduledDate"
        label="実施日"
        type="date"
        required
        state={state}
        defaultValue={iv.scheduledDate}
      />

      <div className="space-y-1">
        <label
          htmlFor="assignedUserId"
          className="block text-sm font-medium text-foreground"
        >
          担当者
        </label>
        <Select
          id="assignedUserId"
          name="assignedUserId"
          defaultValue={assigneeValue}
        >
          <option value="">（未割当）</option>
          {assignedUserOptions.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1">
        <label
          htmlFor="memo"
          className="block text-sm font-medium text-foreground"
        >
          メモ
        </label>
        <VoiceTextarea
          id="memo"
          name="memo"
          rows={3}
          maxLength={2000}
          defaultValue={memoValue}
          aria-invalid={memoError ? 'true' : undefined}
          voiceFieldLabel="メモ"
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
