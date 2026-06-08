/**
 * 没年月日の判明度 (DateOfDeathPrecision) を扱う純関数群。
 *
 * 過去帳運用では「年月日すべて判明」だけでなく、「年月まで判明 (日不明)」「年のみ判明」
 * 「明治以前で完全不明」が現実に存在する。フォーム入力 (年/月/日) を解釈して精度を判定し、
 * 表示文字列・並べ替えキー・DB へ書き込む正規化済みフィールドを組み立てる。
 *
 * DB アクセスや副作用は持たない (テスト容易性のため lib に隔離する)。
 */

export type DateOfDeathPrecision = 'FULL' | 'YEAR_MONTH' | 'YEAR' | 'UNKNOWN';

/** フォームから受け取る生の没年月日 (各欄は未入力なら null)。 */
export type DeathDateInput = {
  year: number | null;
  month: number | null;
  day: number | null;
};

/** 正規化済みの没年月日。DB の DeathLedgerEntry へそのまま書き込める形。 */
export type NormalizedDeathDate = {
  precision: DateOfDeathPrecision;
  year: number | null;
  month: number | null;
  day: number | null;
  /** 精度が FULL のときのみ Date を持つ (DATE 精度の既存クエリとの後方互換)。 */
  date: Date | null;
};

export type DeathDateError =
  | 'year_required_for_month'
  | 'month_required_for_day'
  | 'year_out_of_range'
  | 'month_out_of_range'
  | 'day_out_of_range'
  | 'invalid_calendar_date';

export type DeathDateParseResult =
  | { ok: true; value: NormalizedDeathDate }
  | { ok: false; error: DeathDateError };

const MIN_YEAR = 1; // 元号以前 (西暦) も含め広く許容する
const MAX_YEAR = 9999;

function daysInMonth(year: number, month: number): number {
  // month は 1-12。Date(year, month, 0) で「その月の末日」が取れる。
  return new Date(year, month, 0).getDate();
}

/**
 * フォーム入力 (年/月/日) を検証し、精度判定込みの正規化済み没年月日を返す。
 *
 * ルール:
 * - 年が無ければ月・日も指定不可 (UNKNOWN のみ)。
 * - 月が無ければ日は指定不可。
 * - すべて揃えば実在日チェック (2/30 等を弾く) を行い FULL とする。
 */
export function parseDeathDate(input: DeathDateInput): DeathDateParseResult {
  const { year, month, day } = input;

  if (year === null) {
    if (month !== null) return { ok: false, error: 'year_required_for_month' };
    if (day !== null) return { ok: false, error: 'month_required_for_day' };
    return {
      ok: true,
      value: { precision: 'UNKNOWN', year: null, month: null, day: null, date: null },
    };
  }

  if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) {
    return { ok: false, error: 'year_out_of_range' };
  }

  if (month === null) {
    if (day !== null) return { ok: false, error: 'month_required_for_day' };
    return {
      ok: true,
      value: { precision: 'YEAR', year, month: null, day: null, date: null },
    };
  }

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return { ok: false, error: 'month_out_of_range' };
  }

  if (day === null) {
    return {
      ok: true,
      value: { precision: 'YEAR_MONTH', year, month, day: null, date: null },
    };
  }

  if (!Number.isInteger(day) || day < 1 || day > 31) {
    return { ok: false, error: 'day_out_of_range' };
  }
  if (day > daysInMonth(year, month)) {
    return { ok: false, error: 'invalid_calendar_date' };
  }

  // FULL のときだけ DATE 用の Date を作る。UTC 正午で作って TZ ずれによる日付跨ぎを防ぐ。
  const date = new Date(Date.UTC(year, month - 1, day));

  return {
    ok: true,
    value: { precision: 'FULL', year, month, day, date },
  };
}

/**
 * 表示用の西暦文字列。精度に応じて欠落部分を伏せる。
 * 例: FULL → "2024年3月15日" / YEAR_MONTH → "2024年3月" / YEAR → "2024年" / UNKNOWN → "不明"
 */
export function formatDeathDateSeireki(value: {
  precision: DateOfDeathPrecision;
  year: number | null;
  month: number | null;
  day: number | null;
}): string {
  switch (value.precision) {
    case 'FULL':
      return `${value.year}年${value.month}月${value.day}日`;
    case 'YEAR_MONTH':
      return `${value.year}年${value.month}月`;
    case 'YEAR':
      return `${value.year}年`;
    case 'UNKNOWN':
      return '不明';
  }
}

/**
 * 命日順 (年→月→日) の安定ソートキー。不明欄は最後に回す。
 * 数値配列を返すので、配列比較でそのまま昇順ソートに使える。
 */
export function deathDateSortKey(value: {
  year: number | null;
  month: number | null;
  day: number | null;
}): [number, number, number] {
  const FAR_FUTURE = Number.MAX_SAFE_INTEGER;
  return [
    value.year ?? FAR_FUTURE,
    value.month ?? FAR_FUTURE,
    value.day ?? FAR_FUTURE,
  ];
}

/**
 * 命日 (月日) のみの比較キー。同年内・月命日案内の並べ替え等に使う。
 * 月日不明は最後に回す。
 */
export function monthDaySortKey(value: {
  month: number | null;
  day: number | null;
}): [number, number] {
  const FAR = 99;
  return [value.month ?? FAR, value.day ?? FAR];
}
