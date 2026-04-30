'use server';

import type { TransactionCategory, TransactionDirection } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireCurrentTenantId } from '@/lib/auth';
import { assertValidUuid, isValidUuid, withTenant } from '@/lib/db';
import {
  CATEGORY_BY_DIRECTION,
  TRANSACTION_DIRECTION_ORDER,
  type TransactionFieldName,
  type TransactionFormState,
} from './types';

function readField(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === 'string' ? v.trim() : '';
}

function nullIfBlank(value: string): string | null {
  return value.length === 0 ? null : value;
}

type TransactionValues = Record<TransactionFieldName, string>;

function extractValues(formData: FormData): TransactionValues {
  return {
    direction: readField(formData, 'direction'),
    category: readField(formData, 'category'),
    amount: readField(formData, 'amount'),
    paidAt: readField(formData, 'paidAt'),
    householdId: readField(formData, 'householdId'),
    paymentMethod: readField(formData, 'paymentMethod'),
    memo: readField(formData, 'memo'),
  };
}

function parseAmount(raw: string): number | null {
  // 非負整数 (0 〜 1,000,000,000 円)。先頭ゼロ・小数・カンマ・記号は弾く。
  if (!/^\d+$/.test(raw)) return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000_000) return null;
  return n;
}

function parseIsoDate(raw: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [y, m, d] = raw.split('-').map((s) => Number.parseInt(s, 10));
  if (
    typeof y !== 'number' ||
    typeof m !== 'number' ||
    typeof d !== 'number' ||
    Number.isNaN(y) ||
    Number.isNaN(m) ||
    Number.isNaN(d)
  ) {
    return null;
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() + 1 !== m ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  return date;
}

function validate(values: TransactionValues): {
  errors: NonNullable<TransactionFormState['errors']>;
  direction: TransactionDirection;
  category: TransactionCategory;
  amount: number;
  paidAt: Date | null;
  householdId: string | null;
} {
  const errors: NonNullable<TransactionFormState['errors']> = {};

  // direction
  let direction: TransactionDirection = 'INCOME';
  if (values.direction.length === 0) {
    errors.direction = '入出金の区分をご選択ください。';
  } else if (
    !(TRANSACTION_DIRECTION_ORDER as string[]).includes(values.direction)
  ) {
    errors.direction = '入出金の区分が不正です。';
  } else {
    direction = values.direction as TransactionDirection;
  }

  // category — direction との整合性をチェック
  let category: TransactionCategory = 'OTHER';
  if (values.category.length === 0) {
    errors.category = 'カテゴリをご選択ください。';
  } else {
    const allowed = errors.direction
      ? // direction エラーの場合はカテゴリ単独では検証できないので、
        // どちらの方向でも許容されるカテゴリとして判定。
        Array.from(
          new Set([
            ...CATEGORY_BY_DIRECTION.INCOME,
            ...CATEGORY_BY_DIRECTION.EXPENSE,
          ]),
        )
      : CATEGORY_BY_DIRECTION[direction];
    if ((allowed as string[]).includes(values.category)) {
      category = values.category as TransactionCategory;
    } else {
      errors.category = 'この入出金区分では選択できないカテゴリです。';
    }
  }

  // amount
  let amount = 0;
  if (values.amount.length === 0) {
    errors.amount = '金額をご入力ください。';
  } else {
    const n = parseAmount(values.amount);
    if (n === null) {
      errors.amount = '金額は 0 〜 1,000,000,000 の整数でご入力ください。';
    } else {
      amount = n;
    }
  }

  // paidAt
  let paidAt: Date | null = null;
  if (values.paidAt.length === 0) {
    errors.paidAt = '日付をご入力ください。';
  } else {
    const d = parseIsoDate(values.paidAt);
    if (d === null) {
      errors.paidAt = '日付の形式が正しくありません。';
    } else {
      paidAt = d;
    }
  }

  // householdId — オプション。指定されていれば UUID 形式チェック。
  let householdId: string | null = null;
  if (values.householdId.length > 0) {
    if (isValidUuid(values.householdId)) {
      householdId = values.householdId;
    } else {
      errors.householdId = '世帯の指定が不正です。';
    }
  }

  return { errors, direction, category, amount, paidAt, householdId };
}

/**
 * 入出金の新規登録。世帯紐付けは任意 (寺側の経費は世帯なし)。
 */
export async function createTransactionAction(
  _prev: TransactionFormState,
  formData: FormData,
): Promise<TransactionFormState> {
  const values = extractValues(formData);
  const v = validate(values);
  if (Object.keys(v.errors).length > 0 || v.paidAt === null) {
    return { status: 'error', errors: v.errors, values };
  }

  const tenantId = await requireCurrentTenantId();

  // householdId が指定されていれば、自テナントの世帯であることを RLS 経由で確認。
  if (v.householdId !== null) {
    const exists = await withTenant(tenantId, (tx) =>
      tx.household.findUnique({
        where: { id: v.householdId! },
        select: { id: true },
      }),
    );
    if (!exists) {
      return {
        status: 'error',
        errors: { householdId: '指定された世帯が見つかりませんでした。' },
        values,
      };
    }
  }

  const created = await withTenant(tenantId, (tx) =>
    tx.transaction.create({
      data: {
        tenantId,
        householdId: v.householdId,
        direction: v.direction,
        category: v.category,
        amount: v.amount,
        paidAt: v.paidAt!,
        paymentMethod: nullIfBlank(values.paymentMethod),
        memo: nullIfBlank(values.memo),
      },
      select: { id: true },
    }),
  );

  revalidatePath('/kaikei');
  if (v.householdId) revalidatePath(`/danshintoto/${v.householdId}`);
  redirect(`/kaikei/${created.id}`);
}

/**
 * 入出金の編集。
 * - 既存の householdId と新しい householdId が変わる場合 (寺側の経費 ↔ 世帯紐付け切替) も許容。
 */
export async function updateTransactionAction(
  _prev: TransactionFormState,
  formData: FormData,
): Promise<TransactionFormState> {
  const id = readField(formData, 'transactionId');
  if (id.length === 0) {
    return { status: 'error', errors: {}, values: extractValues(formData) };
  }
  assertValidUuid(id, 'transactionId');

  const values = extractValues(formData);
  const v = validate(values);
  if (Object.keys(v.errors).length > 0 || v.paidAt === null) {
    return { status: 'error', errors: v.errors, values };
  }

  const tenantId = await requireCurrentTenantId();

  if (v.householdId !== null) {
    const exists = await withTenant(tenantId, (tx) =>
      tx.household.findUnique({
        where: { id: v.householdId! },
        select: { id: true },
      }),
    );
    if (!exists) {
      return {
        status: 'error',
        errors: { householdId: '指定された世帯が見つかりませんでした。' },
        values,
      };
    }
  }

  const previousHouseholdId = await withTenant(tenantId, async (tx) => {
    const existing = await tx.transaction.findUnique({
      where: { id },
      select: { householdId: true },
    });
    if (!existing) {
      throw new Error('対象の入出金が見つかりませんでした。');
    }
    await tx.transaction.update({
      where: { id },
      data: {
        householdId: v.householdId,
        direction: v.direction,
        category: v.category,
        amount: v.amount,
        paidAt: v.paidAt!,
        paymentMethod: nullIfBlank(values.paymentMethod),
        memo: nullIfBlank(values.memo),
      },
    });
    return existing.householdId;
  });

  revalidatePath('/kaikei');
  revalidatePath(`/kaikei/${id}`);
  if (previousHouseholdId)
    revalidatePath(`/danshintoto/${previousHouseholdId}`);
  if (v.householdId && v.householdId !== previousHouseholdId)
    revalidatePath(`/danshintoto/${v.householdId}`);
  redirect(`/kaikei/${id}`);
}
