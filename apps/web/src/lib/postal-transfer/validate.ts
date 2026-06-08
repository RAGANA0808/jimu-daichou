/**
 * 郵便振替 設定フォーム (科目テンプレ / 寺口座情報) の検証 (純関数)。
 */

import type { PostalTransferAmountSource } from '@prisma/client';

export const POSTAL_AMOUNT_SOURCES: readonly PostalTransferAmountSource[] = [
  'NONE',
  'MAINTENANCE_FEE',
  'GRAVE_MAINTENANCE',
] as const;

export const MAX_AMOUNT = 1_000_000_000;

/** 金額文字列を非負整数 (円) にパースする。不正は null。 */
export function parseAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(n) || n < 0 || n > MAX_AMOUNT) return null;
  return n;
}

export type SubjectFieldName =
  | 'name'
  | 'defaultAmount'
  | 'sortOrder'
  | 'amountSource';

export type SubjectInput = {
  name: string;
  defaultAmount: string;
  sortOrder: string;
  amountSource: string;
};

export type SubjectValidationResult = {
  errors: Partial<Record<SubjectFieldName, string>>;
  values: {
    name: string;
    defaultAmount: number;
    sortOrder: number;
    amountSource: PostalTransferAmountSource;
  };
};

/** 科目テンプレ入力の検証 (純関数)。 */
export function validateSubjectInput(
  input: SubjectInput,
): SubjectValidationResult {
  const errors: Partial<Record<SubjectFieldName, string>> = {};

  const name = input.name.trim();
  if (name.length === 0) {
    errors.name = '科目名をご入力ください。';
  } else if (name.length > 40) {
    errors.name = '科目名は 40 文字以内でご入力ください。';
  }

  let defaultAmount = 0;
  const amt = parseAmount(input.defaultAmount.length === 0 ? '0' : input.defaultAmount);
  if (amt === null) {
    errors.defaultAmount = '既定金額は 0 〜 1,000,000,000 の整数でご入力ください。';
  } else {
    defaultAmount = amt;
  }

  let sortOrder = 0;
  if (input.sortOrder.trim().length > 0) {
    const n = Number.parseInt(input.sortOrder.trim(), 10);
    if (Number.isNaN(n) || n < 0 || n > 9999) {
      errors.sortOrder = '表示順は 0 〜 9999 の整数でご入力ください。';
    } else {
      sortOrder = n;
    }
  }

  let amountSource: PostalTransferAmountSource = 'NONE';
  if (input.amountSource.length > 0) {
    if ((POSTAL_AMOUNT_SOURCES as string[]).includes(input.amountSource)) {
      amountSource = input.amountSource as PostalTransferAmountSource;
    } else {
      errors.amountSource = '金額の連動元が不正です。';
    }
  }

  return {
    errors,
    values: { name, defaultAmount, sortOrder, amountSource },
  };
}

export type AccountFieldName =
  | 'postalAccountName'
  | 'postalAccountSymbol'
  | 'postalAccountNumber'
  | 'postalTransferNote'
  | 'postalPrintOffsetXMm'
  | 'postalPrintOffsetYMm';

export type AccountInput = Record<AccountFieldName, string>;

export type AccountValidationResult = {
  errors: Partial<Record<AccountFieldName, string>>;
  values: {
    postalAccountName: string | null;
    postalAccountSymbol: string | null;
    postalAccountNumber: string | null;
    postalTransferNote: string | null;
    postalPrintOffsetXMm: number;
    postalPrintOffsetYMm: number;
  };
};

const OFFSET_LIMIT = 30;

function parseOffset(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return 0;
  const n = Number.parseFloat(trimmed);
  if (!Number.isFinite(n) || n < -OFFSET_LIMIT || n > OFFSET_LIMIT) return null;
  return n;
}

function nullIfBlank(value: string): string | null {
  const t = value.trim();
  return t.length === 0 ? null : t;
}

/** 寺口座情報 + 印字オフセットの検証 (純関数)。 */
export function validateAccountInput(
  input: AccountInput,
): AccountValidationResult {
  const errors: Partial<Record<AccountFieldName, string>> = {};

  const name = input.postalAccountName.trim();
  if (name.length > 60) errors.postalAccountName = '60 文字以内でご入力ください。';

  const symbol = input.postalAccountSymbol.trim();
  if (symbol.length > 0 && !/^[0-9-]{1,15}$/.test(symbol)) {
    errors.postalAccountSymbol = '口座記号は数字とハイフンでご入力ください。';
  }

  const number = input.postalAccountNumber.trim();
  if (number.length > 0 && !/^[0-9-]{1,15}$/.test(number)) {
    errors.postalAccountNumber = '口座番号は数字とハイフンでご入力ください。';
  }

  const note = input.postalTransferNote.trim();
  if (note.length > 200) errors.postalTransferNote = '200 文字以内でご入力ください。';

  let offsetX = 0;
  const ox = parseOffset(input.postalPrintOffsetXMm);
  if (ox === null) {
    errors.postalPrintOffsetXMm = `横オフセットは -${OFFSET_LIMIT} 〜 ${OFFSET_LIMIT} mm でご入力ください。`;
  } else {
    offsetX = ox;
  }

  let offsetY = 0;
  const oy = parseOffset(input.postalPrintOffsetYMm);
  if (oy === null) {
    errors.postalPrintOffsetYMm = `縦オフセットは -${OFFSET_LIMIT} 〜 ${OFFSET_LIMIT} mm でご入力ください。`;
  } else {
    offsetY = oy;
  }

  return {
    errors,
    values: {
      postalAccountName: nullIfBlank(input.postalAccountName),
      postalAccountSymbol: nullIfBlank(input.postalAccountSymbol),
      postalAccountNumber: nullIfBlank(input.postalAccountNumber),
      postalTransferNote: nullIfBlank(input.postalTransferNote),
      postalPrintOffsetXMm: offsetX,
      postalPrintOffsetYMm: offsetY,
    },
  };
}
