/**
 * インポート用の没年月日テキスト解釈 (純関数)。
 *
 * 過去帳/位牌台帳 CSV の没年月日欄は表記が多様:
 * - 西暦: "2024-03-15" / "2024/3/15" / "2024.3.15" / "2024年3月15日"
 * - 年のみ・年月のみ: "2024" / "2024年" / "2024-03" / "2024年3月"
 * - 和暦: "令和6年3月15日" / "明治12年" / "昭和50年8月"
 * - 不明: "" / "不明" / "－" など
 *
 * 和暦表記が来たら lib/wareki で西暦化し、最終的に lib/kakochou/death-date の
 * parseDeathDate へ渡して精度判定込みの正規化済み没年月日を得る。
 *
 * DB アクセスや副作用は持たない (テスト容易性のため lib に隔離する)。
 */

import { findEraByJaName, warekiToSeireki } from '@/lib/wareki';
import {
  parseDeathDate,
  type DeathDateError,
  type NormalizedDeathDate,
} from './death-date';

export type DeathDateCellError =
  | DeathDateError
  | 'unrecognized_format'
  | 'wareki_out_of_range';

export type DeathDateCellResult =
  | { ok: true; value: NormalizedDeathDate }
  | { ok: false; error: DeathDateCellError };

/** 空・不明を表す入力か (この場合 UNKNOWN として取り込む)。 */
const UNKNOWN_TOKENS = new Set(['', '不明', '不詳', '－', '-', 'ー', '―', '?', '？', 'na', 'n/a']);

/** 全角数字を半角へ寄せる。 */
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

/** 和暦元号名で始まる文字列を西暦の年/月/日へ変換する。月日が無ければ null。 */
function parseWareki(
  text: string,
): { ok: true; year: number; month: number | null; day: number | null } | { ok: false } {
  // 元号名 (明治/大正/昭和/平成/令和) + 「元年」または数字年。
  const m = text.match(
    /^(明治|大正|昭和|平成|令和)\s*(元|\d+)\s*年?\s*(?:(\d+)\s*月?)?\s*(?:(\d+)\s*日?)?$/,
  );
  if (!m) return { ok: false };
  const era = findEraByJaName(m[1] ?? '');
  if (!era) return { ok: false };
  const warekiYear = m[2] === '元' ? 1 : toInt(m[2]);
  if (warekiYear === null) return { ok: false };
  const month = toInt(m[3]);
  const day = toInt(m[4]);

  // 年だけ / 年月だけのとき warekiToSeireki は実在日チェックで弾くため、
  // 元号開始年からのオフセットだけで西暦年を求める (lib/wareki と同じ規則)。
  if (month === null || day === null) {
    return { ok: true, year: era.startYear + warekiYear - 1, month, day };
  }
  try {
    const s = warekiToSeireki({ era: era.code, year: warekiYear, month, day });
    return { ok: true, year: s.year, month: s.month, day: s.day };
  } catch {
    return { ok: false };
  }
}

/** 西暦表記 (区切り -, /, ., 年月日) を年/月/日へ分解する。 */
function parseSeireki(
  text: string,
): { year: number; month: number | null; day: number | null } | null {
  // "2024年3月15日" 形式
  const ja = text.match(/^(\d{1,4})\s*年\s*(?:(\d{1,2})\s*月)?\s*(?:(\d{1,2})\s*日)?$/);
  if (ja) {
    return { year: Number.parseInt(ja[1] ?? '', 10), month: toInt(ja[2]), day: toInt(ja[3]) };
  }
  // "2024-03-15" / "2024/3/15" / "2024.3.15" / "2024-03" / "2024"
  const sep = text.match(/^(\d{1,4})(?:[-/.](\d{1,2}))?(?:[-/.](\d{1,2}))?$/);
  if (sep) {
    return { year: Number.parseInt(sep[1] ?? '', 10), month: toInt(sep[2]), day: toInt(sep[3]) };
  }
  return null;
}

/**
 * 没年月日テキストを解釈し、精度判定込みの正規化済み没年月日を返す。
 * 空・不明トークンは UNKNOWN (取り込み可) として扱う。
 */
export function parseDeathDateCell(raw: string): DeathDateCellResult {
  const trimmed = raw.trim();
  if (UNKNOWN_TOKENS.has(trimmed.toLowerCase())) {
    return parseToResult(null, null, null);
  }

  const normalized = toHalfWidthDigits(trimmed);

  if (/^(明治|大正|昭和|平成|令和)/.test(normalized)) {
    const w = parseWareki(normalized);
    if (!w.ok) return { ok: false, error: 'wareki_out_of_range' };
    return parseToResult(w.year, w.month, w.day);
  }

  const s = parseSeireki(normalized);
  if (s === null) return { ok: false, error: 'unrecognized_format' };
  return parseToResult(s.year, s.month, s.day);
}

function parseToResult(
  year: number | null,
  month: number | null,
  day: number | null,
): DeathDateCellResult {
  const parsed = parseDeathDate({ year, month, day });
  if (!parsed.ok) return { ok: false, error: parsed.error };
  return { ok: true, value: parsed.value };
}
