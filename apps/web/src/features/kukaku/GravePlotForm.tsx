'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import type { GravePlotArea, Household } from '@prisma/client';
import {
  initialGravePlotFormState,
  GRAVE_PLOT_STATUS_LABELS,
  GRAVE_PLOT_STATUS_ORDER,
  GRAVE_PLOT_TYPE_LABELS,
  GRAVE_PLOT_TYPE_ORDER,
  type GravePlotFieldName,
  type GravePlotFormState,
} from './types';

type GravePlotAction = (
  prev: GravePlotFormState,
  formData: FormData,
) => Promise<GravePlotFormState>;

type HouseholdOption = Pick<Household, 'id' | 'householderName' | 'nameKana'>;
type AreaOption = Pick<GravePlotArea, 'id' | 'name'>;

type Props = {
  action: GravePlotAction;
  submitLabel: string;
  cancelHref: string;
  householdOptions: HouseholdOption[];
  areaOptions: AreaOption[];
  initialValues?: Partial<Record<GravePlotFieldName, string>>;
  /** 編集時に hidden 送信する区画 ID */
  gravePlotId?: string;
};

type FieldProps = {
  name: GravePlotFieldName;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  state: GravePlotFormState;
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
        inputMode={type === 'number' ? 'numeric' : undefined}
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
  name: GravePlotFieldName;
  label: string;
  state: GravePlotFormState;
  defaultValue?: string;
}) {
  const error = state.errors?.[name];
  const value = state.values?.[name] ?? defaultValue ?? '';
  return (
    <div className="space-y-1">
      <label htmlFor={name} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      <textarea
        id={name}
        name={name}
        rows={3}
        defaultValue={value}
        aria-invalid={error ? 'true' : undefined}
        className="block w-full rounded border border-border px-3 py-2 text-base focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
      />
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}

export function GravePlotForm({
  action,
  submitLabel,
  cancelHref,
  householdOptions,
  areaOptions,
  initialValues,
  gravePlotId,
}: Props) {
  const [state, formAction, isPending] = useActionState(
    action,
    initialGravePlotFormState,
  );
  const iv = initialValues ?? {};

  const plotTypeError = state.errors?.plotType;
  const statusError = state.errors?.status;
  const householdError = state.errors?.householdId;
  const areaError = state.errors?.areaId;

  const plotTypeValue = state.values?.plotType ?? iv.plotType ?? '';
  const statusValue = state.values?.status ?? iv.status ?? 'AVAILABLE';
  const householdValue = state.values?.householdId ?? iv.householdId ?? '';
  const areaValue = state.values?.areaId ?? iv.areaId ?? '';

  return (
    <form action={formAction} noValidate className="space-y-5">
      {gravePlotId && (
        <input type="hidden" name="gravePlotId" value={gravePlotId} />
      )}

      <TextField
        name="plotNumber"
        label="区画番号"
        required
        placeholder="例: A-12 / 永代-03"
        state={state}
        defaultValue={iv.plotNumber}
      />

      <div className="space-y-1">
        <label
          htmlFor="plotType"
          className="block text-sm font-medium text-foreground"
        >
          区画種別<span className="ml-1 text-red-600">*</span>
        </label>
        <select
          id="plotType"
          name="plotType"
          required
          defaultValue={plotTypeValue}
          aria-invalid={plotTypeError ? 'true' : undefined}
          className="block w-full rounded border border-border px-3 py-2 text-base focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        >
          <option value="">選択してください</option>
          {GRAVE_PLOT_TYPE_ORDER.map((t) => (
            <option key={t} value={t}>
              {GRAVE_PLOT_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        {plotTypeError && (
          <p className="text-sm text-red-700">{plotTypeError}</p>
        )}
      </div>

      <div className="space-y-1">
        <label
          htmlFor="status"
          className="block text-sm font-medium text-foreground"
        >
          状態
        </label>
        <select
          id="status"
          name="status"
          defaultValue={statusValue}
          aria-invalid={statusError ? 'true' : undefined}
          className="block w-full rounded border border-border px-3 py-2 text-base focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        >
          {GRAVE_PLOT_STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {GRAVE_PLOT_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        {statusError && <p className="text-sm text-red-700">{statusError}</p>}
      </div>

      <div className="space-y-1">
        <label
          htmlFor="householdId"
          className="block text-sm font-medium text-foreground"
        >
          契約世帯
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            (使用中・予約済の場合は必須)
          </span>
        </label>
        <select
          id="householdId"
          name="householdId"
          defaultValue={householdValue}
          aria-invalid={householdError ? 'true' : undefined}
          className="block w-full rounded border border-border px-3 py-2 text-base focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        >
          <option value="">(未選択)</option>
          {householdOptions.map((h) => (
            <option key={h.id} value={h.id}>
              {h.householderName} ({h.nameKana})
            </option>
          ))}
        </select>
        {householdError && (
          <p className="text-sm text-red-700">{householdError}</p>
        )}
      </div>

      <div className="space-y-1">
        <label
          htmlFor="areaId"
          className="block text-sm font-medium text-foreground"
        >
          エリア
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            (地図上の配置先。未選択なら地図に表示されない)
          </span>
        </label>
        <select
          id="areaId"
          name="areaId"
          defaultValue={areaValue}
          aria-invalid={areaError ? 'true' : undefined}
          className="block w-full rounded border border-border px-3 py-2 text-base focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        >
          <option value="">(未選択)</option>
          {areaOptions.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        {areaError && <p className="text-sm text-red-700">{areaError}</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          name="contractDate"
          label="契約日"
          type="date"
          state={state}
          defaultValue={iv.contractDate}
        />
        <TextField
          name="contractPlan"
          label="契約プラン"
          placeholder="例: 永代供養 30 年"
          state={state}
          defaultValue={iv.contractPlan}
        />
      </div>

      <TextField
        name="monumentName"
        label="墓標名"
        placeholder="例: 山田家之墓 / 先祖代々之墓"
        state={state}
        defaultValue={iv.monumentName}
      />

      <TextareaField
        name="inscription"
        label="刻名"
        state={state}
        defaultValue={iv.inscription}
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
