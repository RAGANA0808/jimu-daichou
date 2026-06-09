import { describe, expect, it } from 'vitest';
import { computeExpiryDate, isExpiringSoon, monthsUntil } from './contract';

/** @db.Date 用に UTC 00:00 の Date を組み立てるヘルパ。 */
function utcDate(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d));
}

describe('computeExpiryDate', () => {
  it('開始日 + 預かり年数 を満了日とする', () => {
    const expiry = computeExpiryDate(utcDate(2020, 3, 15), 33);
    expect(expiry).not.toBeNull();
    expect(expiry?.getUTCFullYear()).toBe(2053);
    expect(expiry?.getUTCMonth()).toBe(2); // March
    expect(expiry?.getUTCDate()).toBe(15);
  });

  it('預かり年数が null (永代供養) なら満了なし → null', () => {
    expect(computeExpiryDate(utcDate(2020, 3, 15), null)).toBeNull();
  });

  it('開始日が null なら算出不能 → null', () => {
    expect(computeExpiryDate(null, 33)).toBeNull();
  });

  it('預かり年数 0 は同日を満了日とする', () => {
    const expiry = computeExpiryDate(utcDate(2024, 1, 1), 0);
    expect(expiry?.getUTCFullYear()).toBe(2024);
    expect(expiry?.getUTCMonth()).toBe(0);
    expect(expiry?.getUTCDate()).toBe(1);
  });

  it('うるう日 2/29 は Date.UTC が翌年の暦日へ正規化する', () => {
    // 2020-02-29 + 1 年 → 2021-02-29 は存在しないため 2021-03-01 に繰り上がる
    const expiry = computeExpiryDate(utcDate(2020, 2, 29), 1);
    expect(expiry?.getUTCFullYear()).toBe(2021);
    expect(expiry?.getUTCMonth()).toBe(2); // March
    expect(expiry?.getUTCDate()).toBe(1);
  });

  it('NaN の預かり年数は null (不正値を満了日に持ち込まない)', () => {
    expect(computeExpiryDate(utcDate(2020, 3, 15), Number.NaN)).toBeNull();
  });
});

describe('monthsUntil', () => {
  it('満了日 null は null', () => {
    expect(monthsUntil(null, utcDate(2026, 6, 7))).toBeNull();
  });

  it('未来の満了日は正の残月数', () => {
    // now=2026-06 → expiry=2027-06 は 12 ヶ月先
    const months = monthsUntil(utcDate(2027, 6, 1), new Date(2026, 5, 7));
    expect(months).toBe(12);
  });

  it('過去の満了日は負の残月数 (合祀期限到来済み)', () => {
    const months = monthsUntil(utcDate(2025, 6, 1), new Date(2026, 5, 7));
    expect(months).toBe(-12);
  });

  it('同月は 0', () => {
    const months = monthsUntil(utcDate(2026, 6, 30), new Date(2026, 5, 7));
    expect(months).toBe(0);
  });
});

describe('isExpiringSoon', () => {
  it('満了日 null は対象外 (false)', () => {
    expect(isExpiringSoon(null, 12, new Date(2026, 5, 7))).toBe(false);
  });

  it('既定 12 ヶ月以内は間近 (true)', () => {
    expect(isExpiringSoon(utcDate(2026, 12, 1), 12, new Date(2026, 5, 7))).toBe(
      true,
    );
  });

  it('12 ヶ月より先は間近でない (false)', () => {
    expect(isExpiringSoon(utcDate(2028, 1, 1), 12, new Date(2026, 5, 7))).toBe(
      false,
    );
  });

  it('既に満了済 (残月数 <= 0) も間近に含める', () => {
    expect(isExpiringSoon(utcDate(2025, 1, 1), 12, new Date(2026, 5, 7))).toBe(
      true,
    );
  });
});
