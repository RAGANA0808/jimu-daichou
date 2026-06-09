/**
 * 墓地 年間管理料 (E27) フォーム入力の検証 (純関数)。Server Action から切り離し Vitest で網羅する。
 * 金額は円・整数。日付は JST 前提 (@db.Date は new Date(Date.UTC(...)) で保存)。
 */

import type { GraveMaintenanceMethod } from '@prisma/client';

export const GRAVE_MAINTENANCE_METHODS: readonly GraveMaintenanceMethod[] = [
  'BANK_TRANSFER',
  'POSTAL_TRANSFER',
  'ANNUAL_LUMP',
  'CASH',
  'OTHER',
];

/** 金額 (円・非負整数 0〜10,000,000)。先頭ゼロ・小数・記号は弾く。 */
export function parseYenAmount(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0 || n > 10_000_000) return null;
  return n;
}

/** 正の入金額 (1〜10,000,000)。0 は入金として認めない。 */
export function parsePaymentAmount(raw: string): number | null {
  const n = parseYenAmount(raw);
  if (n === null || n <= 0) return null;
  return n;
}

/** 年度 (西暦 2000〜2200)。 */
export function parseFiscalYear(raw: string): number | null {
  if (!/^\d{4}$/.test(raw)) return null;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n) || n < 2000 || n > 2200) return null;
  return n;
}

/**
 * `YYYY-MM-DD` を @db.Date 保存用の UTC 0 時 Date に変換する (既存慣習)。不正なら null。
 */
export function parseDbDate(raw: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [y, m, d] = raw.split('-').map((s) => Number.parseInt(s, 10));
  if (
    y === undefined ||
    m === undefined ||
    d === undefined ||
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

export type PlanFieldName = 'annualAmount' | 'method' | 'basis' | 'note';

export type PlanInput = {
  annualAmount: string;
  method: string;
  basis: string;
  note: string;
};

export type PlanValidationResult = {
  errors: Partial<Record<PlanFieldName, string>>;
  values: {
    annualAmount: number;
    method: GraveMaintenanceMethod;
    basis: string | null;
    note: string | null;
  };
};

function nullIfBlank(s: string): string | null {
  return s.length === 0 ? null : s;
}

/** 管理料台帳フォームの検証。 */
export function validatePlanInput(input: PlanInput): PlanValidationResult {
  const errors: Partial<Record<PlanFieldName, string>> = {};

  let annualAmount = 0;
  if (input.annualAmount.trim().length === 0) {
    errors.annualAmount = '年額管理料をご入力ください。';
  } else {
    const n = parseYenAmount(input.annualAmount.trim());
    if (n === null) {
      errors.annualAmount =
        '年額管理料は 0 〜 10,000,000 の整数 (円) でご入力ください。';
    } else {
      annualAmount = n;
    }
  }

  let method: GraveMaintenanceMethod = 'BANK_TRANSFER';
  if ((GRAVE_MAINTENANCE_METHODS as string[]).includes(input.method)) {
    method = input.method as GraveMaintenanceMethod;
  } else {
    errors.method = '納入区分をご選択ください。';
  }

  const basis = input.basis.trim();
  if (basis.length > 1000) {
    errors.basis = '賦課根拠は 1000 文字以内でご入力ください。';
  }

  const note = input.note.trim();
  if (note.length > 1000) {
    errors.note = '備考は 1000 文字以内でご入力ください。';
  }

  return {
    errors,
    values: {
      annualAmount,
      method,
      basis: nullIfBlank(basis),
      note: nullIfBlank(note),
    },
  };
}
