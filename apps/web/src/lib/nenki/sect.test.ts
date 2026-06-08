import { describe, expect, it } from 'vitest';
import { getSectDefaultCutoff, SECT_LABELS, SECT_OPTIONS } from './sect';

describe('getSectDefaultCutoff', () => {
  it('浄土真宗系は 33 (三十三回忌)', () => {
    expect(getSectDefaultCutoff('JODO_SHINSHU_HONGANJI')).toBe(33);
    expect(getSectDefaultCutoff('SHINSHU_OTANI')).toBe(33);
  });

  it('曹洞宗・他宗派は null (標準=五十回忌まで)', () => {
    expect(getSectDefaultCutoff('SOTO')).toBeNull();
    expect(getSectDefaultCutoff('JODO')).toBeNull();
    expect(getSectDefaultCutoff('NICHIREN')).toBeNull();
    expect(getSectDefaultCutoff('OTHER')).toBeNull();
  });

  it('null (未設定) は null', () => {
    expect(getSectDefaultCutoff(null)).toBeNull();
  });

  it('未知の文字列は null (標準にフォールバック)', () => {
    expect(getSectDefaultCutoff('ZEN')).toBeNull();
    expect(getSectDefaultCutoff('')).toBeNull();
  });
});

describe('effectiveCutoff の合成 (entryCutoff ?? sectDefault)', () => {
  // 呼び出し側の合成ロジックを再現するヘルパ (per-entry が常に優先)。
  const effectiveCutoff = (
    entryCutoff: number | null,
    sectDefault: number | null,
  ): number | null => entryCutoff ?? sectDefault;

  it('per-entry cutoff が常に宗派既定を override する', () => {
    // 浄土真宗 (sectDefault=33) でも、故人が 50 を持てば 50 が優先
    const sectDefault = getSectDefaultCutoff('JODO_SHINSHU_HONGANJI'); // 33
    expect(effectiveCutoff(50, sectDefault)).toBe(50);
    // entry が null のときだけ宗派既定にフォールバック
    expect(effectiveCutoff(null, sectDefault)).toBe(33);
  });

  it('曹洞宗 (sectDefault=null) で entry も null なら null (現状維持)', () => {
    const sectDefault = getSectDefaultCutoff('SOTO'); // null
    expect(effectiveCutoff(null, sectDefault)).toBeNull();
  });
});

describe('SECT_OPTIONS / SECT_LABELS', () => {
  it('全 11 宗派が options に含まれる', () => {
    expect(SECT_OPTIONS).toHaveLength(11);
  });

  it('value→label が SECT_LABELS と一致する', () => {
    for (const opt of SECT_OPTIONS) {
      expect(opt.label).toBe(SECT_LABELS[opt.value]);
    }
  });
});
