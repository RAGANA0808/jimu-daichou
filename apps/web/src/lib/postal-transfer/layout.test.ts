import { describe, expect, it } from 'vitest';
import {
  clampOffsetMm,
  mmToPt,
  OFFSET_LIMIT_MM,
  placeField,
  POSTAL_SLIP_FIELDS,
} from './layout';

describe('mmToPt', () => {
  it('25.4mm = 72pt', () => {
    expect(mmToPt(25.4)).toBeCloseTo(72, 5);
  });
  it('0mm = 0pt', () => {
    expect(mmToPt(0)).toBe(0);
  });
});

describe('placeField', () => {
  it('オフセット未指定なら基準座標をそのまま返す', () => {
    const base = POSTAL_SLIP_FIELDS.amount;
    const placed = placeField('amount');
    expect(placed.xMm).toBe(base.xMm);
    expect(placed.yMm).toBe(base.yMm);
    expect(placed.fontSizePt).toBe(base.fontSizePt);
  });
  it('オフセットを加算する', () => {
    const base = POSTAL_SLIP_FIELDS.payerName;
    const placed = placeField('payerName', { xMm: 2, yMm: -3 });
    expect(placed.xMm).toBe(base.xMm + 2);
    expect(placed.yMm).toBe(base.yMm - 3);
  });
});

describe('clampOffsetMm', () => {
  it('安全域内はそのまま', () => {
    expect(clampOffsetMm(5)).toBe(5);
    expect(clampOffsetMm(-5)).toBe(-5);
  });
  it('上下限でクランプする', () => {
    expect(clampOffsetMm(999)).toBe(OFFSET_LIMIT_MM);
    expect(clampOffsetMm(-999)).toBe(-OFFSET_LIMIT_MM);
  });
  it('NaN は 0 に倒す', () => {
    expect(clampOffsetMm(Number.NaN)).toBe(0);
  });
});
