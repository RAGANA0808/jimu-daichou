/**
 * 郵便振替 払込取扱票 (E35) の科目・金額計算 (純関数, DB アクセスなし)。
 *
 * 科目テンプレ (護持会費/墓地管理費/お布施/寄付 等) と世帯ごとの金額を組み合わせ、
 * 払込金額の合計を算出する。E07/E27 の当年度請求額を初期値に流し込む処理は、
 * 上位 (queries) で各科目に解決した金額を渡してもらう前提で、ここは集計に徹する。
 */

/** 払込取扱票に印字する科目 1 行。 */
export type PostalSubjectLine = {
  /** 科目テンプレ ID (世帯別入力の突合キー)。 */
  subjectId: string;
  /** 科目名 (例: "護持会費")。 */
  name: string;
  /** この世帯のこの科目の金額 (円)。 */
  amount: number;
};

/** 金額が正で、明細・用紙に印字すべき科目行だけに絞る (純関数)。 */
export function visibleLines(lines: PostalSubjectLine[]): PostalSubjectLine[] {
  return lines.filter((l) => l.amount > 0);
}

/** 科目行の合計金額 (円) を返す (純関数)。負の金額は 0 として扱う。 */
export function sumSubjectAmounts(lines: PostalSubjectLine[]): number {
  return lines.reduce((sum, l) => sum + (l.amount > 0 ? l.amount : 0), 0);
}

/** 金額表記 (例: "10,000")。¥ や円は呼び出し側で付ける。 */
export function formatAmountDigits(amount: number): string {
  return Math.max(0, Math.trunc(amount)).toLocaleString('ja-JP');
}

/**
 * 払込取扱票 1 枚分のデータ (世帯 1 件分)。
 */
export type PostalSlip = {
  householdId: string;
  householderName: string;
  postalCode: string | null;
  address: string | null;
  /** この世帯に印字する科目行 (金額 0 は除外済み)。 */
  lines: PostalSubjectLine[];
  /** 合計金額 (円)。 */
  total: number;
};

/**
 * 世帯の宛名情報と科目行から払込取扱票 1 枚分を組み立てる (純関数)。
 * 金額 0 の科目は除外し、合計を算出する。
 */
export function buildPostalSlip(input: {
  householdId: string;
  householderName: string;
  postalCode: string | null;
  address: string | null;
  lines: PostalSubjectLine[];
}): PostalSlip {
  const lines = visibleLines(input.lines);
  return {
    householdId: input.householdId,
    householderName: input.householderName,
    postalCode: input.postalCode,
    address: input.address,
    lines,
    total: sumSubjectAmounts(lines),
  };
}

/**
 * 金額が 1 円以上ある (印字に値する) 払込票だけを残す (純関数)。
 * 全科目 0 円の世帯は一括生成の対象から外す。
 */
export function payableSlips(slips: PostalSlip[]): PostalSlip[] {
  return slips.filter((s) => s.total > 0);
}
