/**
 * インポート用の「確定した暦日 (年月日すべて判明)」テキスト解釈 (純関数)。
 *
 * 区画の契約日 (contractDate) や会計の入金日 (paidAt) は DB が DATE 精度の
 * 完全な暦日を前提とする。過去帳の没年月日 (年のみ・月日不明を許容) とは異なり、
 * ここでは「年月日がすべて揃った日付」または「空 (未入力)」のみを受け付ける。
 *
 * 受理する表記:
 * - 西暦: "2024-03-15" / "2024/3/15" / "2024.3.15" / "2024年3月15日"
 * - 和暦: "令和6年3月15日" / "平成20年12月1日"
 *
 * 年のみ・年月のみ・不明トークンは「日付として不完全」としてエラーにする
 * (没年月日のような曖昧さは契約日・入金日では許容しない)。
 *
 * DB アクセスや副作用は持たない (テスト容易性のため lib に隔離する)。
 */

import { findEraByJaName, warekiToSeireki } from '@/lib/wareki';

export type DateCellError = 'incomplete_date' | 'invalid_calendar_date' | 'unrecognized_format';

export type DateCellResult =
  | { ok: true; value: Date | null }
  | { ok: false; error: DateCellError };

/** 空欄を表す入力か (この場合 null として扱う = 未入力)。 */
const BLANK_TOKENS = new Set(['', '－', '-', 'ー', '―', 'na', 'n/a']);

function toHalfWidthDigits(value: string): string {
  return value.replace(/[０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
  );
}

function toInt(value: string | undefined): number | null {
  if (value === undefined || value === '') return null;
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? null : n;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** 和暦元号名で始まる文字列を西暦の年/月/日へ変換する (月日いずれか欠落は ok:false)。 */
function parseWareki(
  text: string,
): { year: number; month: number; day: number } | null {
  const m = text.match(
    /^(明治|大正|昭和|平成|令和)\s*(元|\d+)\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日$/,
  );
  if (!m) return null;
  const era = findEraByJaName(m[1] ?? '');
  if (!era) return null;
  const warekiYear = m[2] === '元' ? 1 : toInt(m[2]);
  const month = toInt(m[3]);
  const day = toInt(m[4]);
  if (warekiYear === null || month === null || day === null) return null;
  try {
    const s = warekiToSeireki({ era: era.code, year: warekiYear, month, day });
    return { year: s.year, month: s.month, day: s.day };
  } catch {
    return null;
  }
}

/** 西暦表記 (区切り -, /, ., 年月日) を年/月/日へ分解する (月日いずれか欠落は null)。 */
function parseSeireki(
  text: string,
): { year: number; month: number; day: number } | null {
  const ja = text.match(/^(\d{1,4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日$/);
  if (ja) {
    return {
      year: Number.parseInt(ja[1] ?? '', 10),
      month: Number.parseInt(ja[2] ?? '', 10),
      day: Number.parseInt(ja[3] ?? '', 10),
    };
  }
  const sep = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (sep) {
    return {
      year: Number.parseInt(sep[1] ?? '', 10),
      month: Number.parseInt(sep[2] ?? '', 10),
      day: Number.parseInt(sep[3] ?? '', 10),
    };
  }
  return null;
}

/** 年のみ・年月のみ等、暦日として不完全な表記かどうか (エラー文言の出し分け用)。 */
function looksIncomplete(text: string): boolean {
  // 年だけ / 年月だけ / 年月日のうち日や月が欠けるパターン。
  return /^\d{1,4}\s*年?(\s*\d{1,2}\s*月?)?$/.test(text) || /^\d{4}[-/.]\d{1,2}$/.test(text);
}

/**
 * 暦日テキストを解釈する。
 * - 空欄/空トークンは ok:true value:null (未入力)。
 * - 年月日が揃った実在日は ok:true value:Date (UTC 正午基準で生成)。
 * - 年のみ等の不完全な日付は ok:false error:'incomplete_date'。
 */
export function parseDateCell(raw: string): DateCellResult {
  const trimmed = raw.trim();
  if (BLANK_TOKENS.has(trimmed.toLowerCase())) {
    return { ok: true, value: null };
  }

  const normalized = toHalfWidthDigits(trimmed);

  let ymd: { year: number; month: number; day: number } | null = null;
  if (/^(明治|大正|昭和|平成|令和)/.test(normalized)) {
    ymd = parseWareki(normalized);
  } else {
    ymd = parseSeireki(normalized);
  }

  if (ymd === null) {
    return {
      ok: false,
      error: looksIncomplete(normalized) ? 'incomplete_date' : 'unrecognized_format',
    };
  }

  const { year, month, day } = ymd;
  if (month < 1 || month > 12 || day < 1 || day > 31 || day > daysInMonth(year, month)) {
    return { ok: false, error: 'invalid_calendar_date' };
  }

  return { ok: true, value: new Date(Date.UTC(year, month - 1, day)) };
}
