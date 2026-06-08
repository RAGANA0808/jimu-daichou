/**
 * 検索の表記ゆれ正規化 (純関数のみ)。
 *
 * 「電話が鳴った瞬間に相手を引ける」ため、入力のゆらぎ (全角/半角・カタカナ/ひらがな・
 * ハイフン有無) を吸収して一致率を上げる。DB アクセスや副作用は持たない。
 */

const FULLWIDTH_OFFSET = 0xfee0; // 全角英数記号 → 半角の差分

/**
 * 全角英数字・記号を半角へ変換する。
 */
function toHalfWidth(value: string): string {
  return value.replace(/[！-～]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - FULLWIDTH_OFFSET),
  );
}

/**
 * カタカナをひらがなへ変換する (濁点・半濁点付きもそのまま移送)。
 */
function katakanaToHiragana(value: string): string {
  return value.replace(/[ァ-ヶ]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60),
  );
}

/**
 * かな表記の正規化キーを返す。
 *
 * - 前後空白を除去し全角/半角空白をまとめて削る (姓名間スペースのゆらぎ対策)。
 * - カタカナをひらがなへ寄せる。
 * - 全角英数を半角化し小文字化する。
 *
 * nameKana 列はひらがな保存を前提とするため、検索語もここでひらがなへ寄せる。
 */
export function normalizeKana(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) return '';
  const halfWidth = toHalfWidth(trimmed);
  const hiragana = katakanaToHiragana(halfWidth);
  return hiragana.replace(/[\s　・]/g, '').toLowerCase();
}

/**
 * 電話番号の正規化キーを返す。数字以外 (ハイフン・括弧・空白・全角) をすべて落とす。
 *
 * 例: "090-1234-5678" / "（090）1234 5678" / "０９０１２３４５６７８" → "09012345678"
 */
export function normalizePhone(value: string): string {
  return toHalfWidth(value).replace(/\D/g, '');
}

/**
 * 検索語が電話番号としての意味を持つか (数字を 2 桁以上含むか) を判定する。
 * 数字 1 桁だけの巨大なヒットを避けるためのしきい値。
 */
export function looksLikePhone(query: string): boolean {
  return normalizePhone(query).length >= 2;
}

/**
 * 入力された電話番号を保存用に正規化する (C-6)。
 *
 * - 全角数字・ハイフン等を半角化する。
 * - 数字とハイフンのみを残し、それ以外 (括弧・空白・全角中黒等) を落とす。
 * - 連続ハイフンを 1 つにまとめ、前後のハイフンを除く。
 *
 * 検索キー (normalizePhone=数字のみ) と異なり、表示用にハイフンは保持する。
 * 区切りの流儀 (市外局番の括り) までは強制せず、入力者の区切りを尊重する。
 * 空相当 (数字を含まない) の入力は空文字を返す (呼び出し側で null 化する想定)。
 */
export function normalizePhoneForStorage(value: string): string {
  const halfWidth = toHalfWidth(value).trim();
  const kept = halfWidth.replace(/[^\d-]/g, '');
  const collapsed = kept.replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '');
  // ハイフンを除いて数字が 1 桁も無ければ意味を成さないので空にする。
  return /\d/.test(collapsed) ? collapsed : '';
}

/**
 * 入力された郵便番号を保存用に正規化する (C-6)。
 *
 * - 全角数字を半角化する。
 * - 数字以外 (ハイフン・空白・"〒" 等) を落とし数字だけ取り出す。
 * - 7 桁ちょうどなら "NNN-NNNN" 形式に整える。それ以外の桁数は数字列のまま返す
 *   (海外住所・旧表記等を弾かず保存する)。
 *
 * 数字を 1 桁も含まない入力は空文字を返す (呼び出し側で null 化する想定)。
 */
export function normalizePostalCode(value: string): string {
  const digits = toHalfWidth(value).replace(/\D/g, '');
  if (digits.length === 0) return '';
  if (digits.length === 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return digits;
}

/**
 * 検索語がかな (氏名) としての意味を持つか。正規化後に 1 文字以上残るか。
 */
export function looksLikeName(query: string): boolean {
  return query.trim().length >= 1;
}

/**
 * 備考メモ/住所のあいまい検索を発火してよい最小文字数。
 *
 * 自由記述への中間一致は母集合が広く、1 文字では実質全件ヒットに近づくため、
 * 電話・かなより厳しめの 2 文字以上を必須とする (暴発防止の生命線)。
 */
export const MEMO_MIN_LENGTH = 2;

/**
 * 検索語が備考メモ/住所のあいまい検索として意味を持つか。
 *
 * かな正規化では拾えない漢字・英数混在の自由記述 (特徴メモ・住所断片) を
 * 原文部分一致で引くための発火判定。trim 後 MEMO_MIN_LENGTH 文字以上で true。
 */
export function looksLikeMemo(query: string): boolean {
  return query.trim().length >= MEMO_MIN_LENGTH;
}
