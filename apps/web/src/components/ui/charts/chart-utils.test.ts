import { describe, expect, it } from 'vitest';
import { barScaleMax, defaultValueFormatter, lineRange } from './chart-utils';

describe('barScaleMax', () => {
  it('通常値は最大値を返す', () => {
    expect(barScaleMax([3, 10, 7])).toBe(10);
  });

  it('空配列は 0 除算回避のため 1 を返す', () => {
    expect(barScaleMax([])).toBe(1);
  });

  it('全 0 は 1 を返す (棒高さ 0・0 除算しない)', () => {
    expect(barScaleMax([0, 0, 0])).toBe(1);
  });

  it('全負は 1 を返す (負値は 0 にクランプする前提)', () => {
    expect(barScaleMax([-5, -2, -100])).toBe(1);
  });

  it('正負混在では正の最大を返す', () => {
    expect(barScaleMax([-50, 4, -1])).toBe(4);
  });
});

describe('lineRange', () => {
  it('通常値は実際の min/max を返す', () => {
    expect(lineRange([3, -2, 10])).toEqual({ min: -2, max: 10 });
  });

  it('空配列はダミーレンジ [-1, 1] を返す', () => {
    expect(lineRange([])).toEqual({ min: -1, max: 1 });
  });

  it('単一要素 (span 0) はダミーレンジに広げる', () => {
    expect(lineRange([5])).toEqual({ min: 4, max: 6 });
  });

  it('全点同値 (全 0) は 0 除算回避のため広げる', () => {
    expect(lineRange([0, 0, 0])).toEqual({ min: -1, max: 1 });
  });

  it('返すレンジは span > 0 を保証する', () => {
    const { min, max } = lineRange([7, 7, 7]);
    expect(max - min).toBeGreaterThan(0);
  });
});

describe('defaultValueFormatter', () => {
  it('日本語ロケールの桁区切りで整形する', () => {
    expect(defaultValueFormatter(1234567)).toBe('1,234,567');
  });

  it('負値も整形する', () => {
    expect(defaultValueFormatter(-1000)).toBe('-1,000');
  });
});
