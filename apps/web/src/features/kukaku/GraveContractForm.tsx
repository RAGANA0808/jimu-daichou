'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import type { Household } from '@prisma/client';
import {
  initialGraveContractFormState,
  GRAVE_CONTRACT_STATUS_LABELS,
  GRAVE_CONTRACT_STATUS_ORDER,
  GRAVE_CONTRACT_TYPE_LABELS,
  GRAVE_CONTRACT_TYPE_ORDER,
  type GraveContractFieldName,
  type GraveContractFormState,
} from './types';

type GraveContractAction = (
  prev: GraveContractFormState,
  formData: FormData,
) => Promise<GraveContractFormState>;

type HouseholdOption = Pick<Household, 'id' | 'householderName' | 'nameKana'>;

type Props = {
  action: GraveContractAction;
  submitLabel: string;
  cancelHref: string;
  gravePlotId: string;
  householdOptions: HouseholdOption[];
  /** 編集時の契約 ID */
  contractId?: string;
  initialValues?: Partial<Record<GraveContractFieldName, string>>;
};

/**
 * 区画契約 (GraveContract) の登録・編集フォーム。
 * 満了日 (expiryDate) は startDate + termYears からサーバー側で算出して保存するため、
 * このフォームでは入力しない (永代供養は預かり年数を空欄に)。
 */
export function GraveContractForm({
  action,
  submitLabel,
  cancelHref,
  gravePlotId,
  householdOptions,
  contractId,
  initialValues,
}: Props) {
  const [state, formAction, isPending] = useActionState(
    action,
    initialGraveContractFormState,
  );
  const iv = initialValues ?? {};

  const typeError = state.errors?.contractType;
  const householdError = state.errors?.householdId;
  const startError = state.errors?.startDate;
  const termError = state.errors?.termYears;
  const statusError = state.errors?.status;
  const feeError = state.errors?.feeAmount;
  const memoError = state.errors?.memo;

  const typeValue = state.values?.contractType ?? iv.contractType ?? 'STANDARD';
  const householdValue = state.values?.householdId ?? iv.householdId ?? '';
  const startValue = state.values?.startDate ?? iv.startDate ?? '';
  const termValue = state.values?.termYears ?? iv.termYears ?? '';
  const statusValue = state.values?.status ?? iv.status ?? 'ACTIVE';
  const feeValue = state.values?.feeAmount ?? iv.feeAmount ?? '';
  const memoValue = state.values?.memo ?? iv.memo ?? '';

  return (
    <form action={formAction} noValidate className="space-y-5">
      <input type="hidden" name="gravePlotId" value={gravePlotId} />
      {contractId && (
        <input type="hidden" name="contractId" value={contractId} />
      )}

      <div className="space-y-1">
        <label
          htmlFor="contractType"
          className="block text-sm font-medium text-foreground"
        >
          契約種別<span className="ml-1 text-red-600">*</span>
        </label>
        <select
          id="contractType"
          name="contractType"
          required
          defaultValue={typeValue}
          aria-invalid={typeError ? 'true' : undefined}
          className="block w-full rounded border border-border px-3 py-2 text-base focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        >
          {GRAVE_CONTRACT_TYPE_ORDER.map((t) => (
            <option key={t} value={t}>
              {GRAVE_CONTRACT_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        {typeError && <p className="text-sm text-red-700">{typeError}</p>}
      </div>

      <div className="space-y-1">
        <label
          htmlFor="householdId"
          className="block text-sm font-medium text-foreground"
        >
          契約世帯
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            (永代供養で世帯不在なら未選択で構いません)
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label
            htmlFor="startDate"
            className="block text-sm font-medium text-foreground"
          >
            契約開始日
          </label>
          <input
            id="startDate"
            name="startDate"
            type="date"
            defaultValue={startValue}
            aria-invalid={startError ? 'true' : undefined}
            className="block w-full rounded border border-border px-3 py-2 text-base focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
          {startError && <p className="text-sm text-red-700">{startError}</p>}
        </div>

        <div className="space-y-1">
          <label
            htmlFor="termYears"
            className="block text-sm font-medium text-foreground"
          >
            預かり年数
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              (永代は空欄)
            </span>
          </label>
          <input
            id="termYears"
            name="termYears"
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="例: 33"
            defaultValue={termValue}
            aria-invalid={termError ? 'true' : undefined}
            className="block w-full rounded border border-border px-3 py-2 text-base focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
          {termError && <p className="text-sm text-red-700">{termError}</p>}
          <p className="text-xs text-muted-foreground">
            開始日と預かり年数から満了日 (合祀期限) を自動で算出して保存します。
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label
            htmlFor="status"
            className="block text-sm font-medium text-foreground"
          >
            契約状態
          </label>
          <select
            id="status"
            name="status"
            defaultValue={statusValue}
            aria-invalid={statusError ? 'true' : undefined}
            className="block w-full rounded border border-border px-3 py-2 text-base focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          >
            {GRAVE_CONTRACT_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {GRAVE_CONTRACT_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          {statusError && <p className="text-sm text-red-700">{statusError}</p>}
        </div>

        <div className="space-y-1">
          <label
            htmlFor="feeAmount"
            className="block text-sm font-medium text-foreground"
          >
            契約料・管理料 (円)
          </label>
          <input
            id="feeAmount"
            name="feeAmount"
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="例: 300000"
            defaultValue={feeValue}
            aria-invalid={feeError ? 'true' : undefined}
            className="block w-full rounded border border-border px-3 py-2 text-base focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
          {feeError && <p className="text-sm text-red-700">{feeError}</p>}
        </div>
      </div>

      <div className="space-y-1">
        <label
          htmlFor="memo"
          className="block text-sm font-medium text-foreground"
        >
          備考
        </label>
        <textarea
          id="memo"
          name="memo"
          rows={3}
          defaultValue={memoValue}
          aria-invalid={memoError ? 'true' : undefined}
          className="block w-full rounded border border-border px-3 py-2 text-base focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
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
