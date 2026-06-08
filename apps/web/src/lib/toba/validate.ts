/**
 * 塔婆申込フォームの純粋バリデーションロジック (DB / Next.js 非依存)。
 * Vitest でユニットテストできるよう server action から切り離す。
 */

export type TobaInput = {
  applicantName: string;
  targetPersonId: string;
  count: string;
  inscription: string;
  offeringAmount: string;
  memo: string;
};

export type TobaFieldError =
  | 'applicantName'
  | 'targetPersonId'
  | 'count'
  | 'inscription'
  | 'offeringAmount'
  | 'memo';

export type TobaValidationResult = {
  errors: Partial<Record<TobaFieldError, string>>;
  count: number;
  offeringAmount: number | null;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseIntegerInRange(
  raw: string,
  min: number,
  max: number,
): number | null {
  const n = Number.parseInt(raw, 10);
  if (
    Number.isNaN(n) ||
    !Number.isFinite(n) ||
    String(n) !== raw ||
    n < min ||
    n > max
  ) {
    return null;
  }
  return n;
}

export function validateTobaInput(input: TobaInput): TobaValidationResult {
  const errors: Partial<Record<TobaFieldError, string>> = {};

  if (input.applicantName.length === 0) {
    errors.applicantName = '申込者名をご入力ください。';
  } else if (input.applicantName.length > 60) {
    errors.applicantName = '60 文字以内でご入力ください。';
  }

  if (input.inscription.length === 0) {
    errors.inscription = '表記文字列をご入力ください。';
  } else if (input.inscription.length > 200) {
    errors.inscription = '200 文字以内でご入力ください。';
  }

  if (
    input.targetPersonId.length > 0 &&
    !UUID_RE.test(input.targetPersonId)
  ) {
    errors.targetPersonId = '対象故人の指定が不正です。';
  }

  let count = 1;
  if (input.count.length === 0) {
    errors.count = '本数をご入力ください。';
  } else {
    const n = parseIntegerInRange(input.count, 1, 1000);
    if (n === null) {
      errors.count = '本数は 1 〜 1000 の整数でご入力ください。';
    } else {
      count = n;
    }
  }

  let offeringAmount: number | null = null;
  if (input.offeringAmount.length > 0) {
    const n = parseIntegerInRange(input.offeringAmount, 0, 10_000_000);
    if (n === null) {
      errors.offeringAmount =
        '御布施額は 0 〜 10,000,000 の整数でご入力ください。';
    } else {
      offeringAmount = n;
    }
  }

  if (input.memo.length > 500) {
    errors.memo = '備考は 500 文字以内でご入力ください。';
  }

  return { errors, count, offeringAmount };
}
