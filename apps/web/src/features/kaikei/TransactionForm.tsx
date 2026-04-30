'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import {
  CATEGORY_BY_DIRECTION,
  initialTransactionFormState,
  TRANSACTION_CATEGORY_LABELS,
  TRANSACTION_DIRECTION_LABELS,
  TRANSACTION_DIRECTION_ORDER,
  type TransactionFieldName,
  type TransactionFormState,
} from './types';
import type { TransactionDirection } from '@prisma/client';

type TransactionAction = (
  prev: TransactionFormState,
  formData: FormData,
) => Promise<TransactionFormState>;

export type HouseholdOption = {
  id: string;
  householderName: string;
  nameKana: string;
};

type Props = {
  action: TransactionAction;
  submitLabel: string;
  cancelHref: string;
  initialValues?: Partial<Record<TransactionFieldName, string>>;
  /** 世帯紐付け select の候補 (空配列なら寺側の経費専用で使う) */
  households: HouseholdOption[];
  /** 編集時のみ hidden 送信する取引 ID */
  transactionId?: string;
  /** 新規登録時に世帯がプリセットされている場合 (世帯詳細から遷移) */
  lockedHouseholdId?: string;
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-sm text-red-700">{message}</p>;
}

export function TransactionForm({
  action,
  submitLabel,
  cancelHref,
  initialValues,
  households,
  transactionId,
  lockedHouseholdId,
}: Props) {
  const [state, formAction, isPending] = useActionState(
    action,
    initialTransactionFormState,
  );
  const iv = initialValues ?? {};

  const initialDirection: TransactionDirection =
    state.values?.direction === 'EXPENSE' ||
    state.values?.direction === 'INCOME'
      ? (state.values.direction as TransactionDirection)
      : iv.direction === 'EXPENSE' || iv.direction === 'INCOME'
        ? (iv.direction as TransactionDirection)
        : 'INCOME';
  const [direction, setDirection] = useState<TransactionDirection>(
    initialDirection,
  );

  // CATEGORY_BY_DIRECTION の各配列は空にならない (types.ts で 3 件以上を保証) が、
  // TypeScript の noUncheckedIndexedAccess 対策で OTHER をフォールバックに置く。
  const categoryValue: string =
    state.values?.category ??
    iv.category ??
    CATEGORY_BY_DIRECTION[direction][0] ??
    'OTHER';
  const amountValue = state.values?.amount ?? iv.amount ?? '';
  const paidAtValue = state.values?.paidAt ?? iv.paidAt ?? '';
  const householdIdValue =
    state.values?.householdId ??
    iv.householdId ??
    lockedHouseholdId ??
    '';
  const paymentMethodValue =
    state.values?.paymentMethod ?? iv.paymentMethod ?? '';
  const memoValue = state.values?.memo ?? iv.memo ?? '';

  const categoryCandidates = CATEGORY_BY_DIRECTION[direction];
  // 方向を切り替えた時に既存カテゴリが新方向で許容されないなら、最初の候補に丸める。
  const safeCategory: string = (categoryCandidates as string[]).includes(
    categoryValue,
  )
    ? categoryValue
    : (categoryCandidates[0] ?? 'OTHER');

  return (
    <form action={formAction} noValidate className="space-y-5">
      {transactionId && (
        <input type="hidden" name="transactionId" value={transactionId} />
      )}

      <div className="space-y-1">
        <span className="block text-sm font-medium text-gray-700">
          区分<span className="ml-1 text-red-600">*</span>
        </span>
        <div className="flex gap-3">
          {TRANSACTION_DIRECTION_ORDER.map((d) => (
            <label
              key={d}
              className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded border px-4 py-2 text-sm ${
                direction === d
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-gray-500'
              }`}
            >
              <input
                type="radio"
                name="direction"
                value={d}
                checked={direction === d}
                onChange={() => setDirection(d)}
                className="sr-only"
              />
              {TRANSACTION_DIRECTION_LABELS[d]}
            </label>
          ))}
        </div>
        <FieldError message={state.errors?.direction} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label
            htmlFor="category"
            className="block text-sm font-medium text-gray-700"
          >
            カテゴリ<span className="ml-1 text-red-600">*</span>
          </label>
          <select
            id="category"
            name="category"
            defaultValue={safeCategory}
            key={`category-${direction}`}
            aria-invalid={state.errors?.category ? 'true' : undefined}
            className="block w-full rounded border border-gray-300 px-3 py-2 text-base focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          >
            {categoryCandidates.map((c) => (
              <option key={c} value={c}>
                {TRANSACTION_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
          <FieldError message={state.errors?.category} />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="amount"
            className="block text-sm font-medium text-gray-700"
          >
            金額<span className="ml-1 text-red-600">*</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              id="amount"
              name="amount"
              type="number"
              inputMode="numeric"
              required
              min={0}
              step={1}
              defaultValue={amountValue}
              placeholder="例: 30000"
              aria-invalid={state.errors?.amount ? 'true' : undefined}
              className="block w-full rounded border border-gray-300 px-3 py-2 text-base focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
            <span className="text-sm text-gray-600">円</span>
          </div>
          <FieldError message={state.errors?.amount} />
        </div>
      </div>

      <div className="space-y-1">
        <label
          htmlFor="paidAt"
          className="block text-sm font-medium text-gray-700"
        >
          日付<span className="ml-1 text-red-600">*</span>
        </label>
        <input
          id="paidAt"
          name="paidAt"
          type="date"
          required
          defaultValue={paidAtValue}
          aria-invalid={state.errors?.paidAt ? 'true' : undefined}
          className="block w-full rounded border border-gray-300 px-3 py-2 text-base focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 sm:max-w-xs"
        />
        <FieldError message={state.errors?.paidAt} />
      </div>

      <div className="space-y-1">
        <label
          htmlFor="householdId"
          className="block text-sm font-medium text-gray-700"
        >
          世帯
        </label>
        {lockedHouseholdId ? (
          <>
            <input
              type="hidden"
              name="householdId"
              value={lockedHouseholdId}
            />
            <p className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
              {households.find((h) => h.id === lockedHouseholdId)
                ?.householderName ?? '(世帯)'}{' '}
              家 (固定)
            </p>
          </>
        ) : (
          <select
            id="householdId"
            name="householdId"
            defaultValue={householdIdValue}
            aria-invalid={state.errors?.householdId ? 'true' : undefined}
            className="block w-full rounded border border-gray-300 px-3 py-2 text-base focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          >
            <option value="">— 寺側の経費・寄付等 (世帯なし) —</option>
            {households.map((h) => (
              <option key={h.id} value={h.id}>
                {h.householderName}（{h.nameKana}）
              </option>
            ))}
          </select>
        )}
        <p className="text-xs text-gray-500">
          護持会費・御布施は世帯を選択。寺側の経費は世帯なしで記録します。
        </p>
        <FieldError message={state.errors?.householdId} />
      </div>

      <div className="space-y-1">
        <label
          htmlFor="paymentMethod"
          className="block text-sm font-medium text-gray-700"
        >
          支払方法
        </label>
        <input
          id="paymentMethod"
          name="paymentMethod"
          type="text"
          defaultValue={paymentMethodValue}
          placeholder="例: 現金 / 銀行振込 / ゆうちょ"
          list="payment-method-suggestions"
          className="block w-full rounded border border-gray-300 px-3 py-2 text-base focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
        />
        <datalist id="payment-method-suggestions">
          <option value="現金" />
          <option value="銀行振込" />
          <option value="ゆうちょ振替" />
          <option value="その他" />
        </datalist>
        <FieldError message={state.errors?.paymentMethod} />
      </div>

      <div className="space-y-1">
        <label htmlFor="memo" className="block text-sm font-medium text-gray-700">
          備考メモ
        </label>
        <textarea
          id="memo"
          name="memo"
          rows={3}
          defaultValue={memoValue}
          aria-invalid={state.errors?.memo ? 'true' : undefined}
          className="block w-full rounded border border-gray-300 px-3 py-2 text-base focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
        />
        <FieldError message={state.errors?.memo} />
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
