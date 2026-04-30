import { describe, expect, it } from 'vitest';
import { formatSeireki, formatWareki } from './format';

describe('formatWareki', () => {
  it('元年表記あり (デフォルト)', () => {
    expect(formatWareki({ era: 'reiwa', year: 1, month: 5, day: 1 })).toBe('令和元年5月1日');
  });

  it('元年表記なしなら「1年」', () => {
    expect(
      formatWareki({ era: 'reiwa', year: 1, month: 5, day: 1 }, { useGannen: false }),
    ).toBe('令和1年5月1日');
  });

  it('2 年目以降は通常の数値', () => {
    expect(formatWareki({ era: 'reiwa', year: 6, month: 3, day: 15 })).toBe('令和6年3月15日');
  });

  it('西暦併記', () => {
    expect(
      formatWareki({ era: 'reiwa', year: 6, month: 3, day: 15 }, { withSeireki: true }),
    ).toBe('令和6年3月15日 (2024/3/15)');
  });

  it('昭和・平成の表示', () => {
    expect(formatWareki({ era: 'showa', year: 50, month: 10, day: 1 })).toBe('昭和50年10月1日');
    expect(formatWareki({ era: 'heisei', year: 1, month: 1, day: 8 })).toBe('平成元年1月8日');
  });
});

describe('formatSeireki', () => {
  it('和暦記法での西暦表示', () => {
    expect(formatSeireki({ year: 2024, month: 3, day: 15 })).toBe('2024年3月15日');
  });
});
