/**
 * 区画契約 (GraveContract) の満了日算出・残月数などの純粋ロジック (G-4)。
 *
 * - 満了日 (expiryDate) は startDate + termYears を確定値として「保存する」。
 *   読み取り側で都度計算しないこと (lib/nenki と同様、計算はここに集約しインライン禁止)。
 * - @db.Date は UTC 00:00 の Date として扱う (CLAUDE.md §4.3)。算出も getUTC* / Date.UTC を使う。
 * - DB アクセス・副作用なし。
 */

/**
 * 契約開始日 (startDate) と預かり年数 (termYears) から満了日を算出する。
 * - termYears が null (永代供養 等) の場合は満了なし → null。
 * - startDate が null の場合は算出不能 → null。
 * - 例: 2020-03-15 + 33 年 → 2053-03-15。うるう年・月末は Date.UTC が吸収する。
 */
export function computeExpiryDate(
  startDate: Date | null,
  termYears: number | null,
): Date | null {
  if (startDate === null) return null;
  if (termYears === null || !Number.isFinite(termYears)) return null;
  const y = startDate.getUTCFullYear();
  const m = startDate.getUTCMonth();
  const d = startDate.getUTCDate();
  return new Date(Date.UTC(y + termYears, m, d));
}

/**
 * 満了日 (expiryDate) までの残月数を返す (今日基準、JST)。
 * - expiryDate が null の場合は null。
 * - 既に満了済 (過去) の場合は負数を返す。
 * - 月単位の概算 (年差 * 12 + 月差)。日の端数は切り捨てず月差のみで判定する。
 */
export function monthsUntil(
  expiryDate: Date | null,
  now: Date = new Date(),
): number | null {
  if (expiryDate === null) return null;
  // now は JST のローカル時刻。expiryDate は UTC 00:00 保存なので UTC 年月で比較する。
  const nowY = now.getFullYear();
  const nowM = now.getMonth();
  const expY = expiryDate.getUTCFullYear();
  const expM = expiryDate.getUTCMonth();
  return (expY - nowY) * 12 + (expM - nowM);
}

/**
 * 満了が「間近 (今日から指定月数以内)」か。合祀期限の気づきに使う。
 * 既に満了済 (残月数 <= 0) も間近に含める。
 */
export function isExpiringSoon(
  expiryDate: Date | null,
  withinMonths = 12,
  now: Date = new Date(),
): boolean {
  const months = monthsUntil(expiryDate, now);
  if (months === null) return false;
  return months <= withinMonths;
}
