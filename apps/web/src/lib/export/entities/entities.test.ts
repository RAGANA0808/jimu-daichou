import { describe, expect, it } from 'vitest';
import { formatFamilyMembers } from './household';
import { deathYearWhere } from './deathLedger';
import { paidAtRange } from './transaction';

describe('formatFamilyMembers', () => {
  it('存命の構成員を「氏名:ふりがな:続柄」を「；」区切りで畳む', () => {
    const s = formatFamilyMembers([
      { name: '山田花子', nameKana: 'やまだはなこ', familyRelation: '配偶者', isDeceased: false },
      { name: '山田一郎', nameKana: 'やまだいちろう', familyRelation: '長男', isDeceased: false },
    ]);
    expect(s).toBe('山田花子:やまだはなこ:配偶者；山田一郎:やまだいちろう:長男');
  });

  it('故人 (isDeceased) は除外する', () => {
    const s = formatFamilyMembers([
      { name: '存命', nameKana: 'そんめい', familyRelation: null, isDeceased: false },
      { name: '故人', nameKana: 'こじん', familyRelation: '父', isDeceased: true },
    ]);
    expect(s).toBe('存命:そんめい:');
  });

  it('構成員なしは空文字', () => {
    expect(formatFamilyMembers([])).toBe('');
  });
});

describe('deathYearWhere', () => {
  it('開始のみ指定', () => {
    expect(deathYearWhere({ fromYear: 1950 })).toEqual({ gte: 1950 });
  });
  it('終了のみ指定', () => {
    expect(deathYearWhere({ toYear: 2000 })).toEqual({ lte: 2000 });
  });
  it('両方指定', () => {
    expect(deathYearWhere({ fromYear: 1950, toYear: 2000 })).toEqual({
      gte: 1950,
      lte: 2000,
    });
  });
  it('未指定なら undefined', () => {
    expect(deathYearWhere({})).toBeUndefined();
  });
});

describe('paidAtRange', () => {
  it('年のみ指定で 1/1〜翌年 1/1', () => {
    const r = paidAtRange({ year: 2024 });
    expect(r?.from).toEqual(new Date(2024, 0, 1));
    expect(r?.to).toEqual(new Date(2025, 0, 1));
  });
  it('年月指定で月初〜翌月初', () => {
    const r = paidAtRange({ year: 2024, month: 3 });
    expect(r?.from).toEqual(new Date(2024, 2, 1));
    expect(r?.to).toEqual(new Date(2024, 3, 1));
  });
  it('年未指定なら null (全期間)', () => {
    expect(paidAtRange({})).toBeNull();
    expect(paidAtRange({ month: 3 })).toBeNull();
  });
});
