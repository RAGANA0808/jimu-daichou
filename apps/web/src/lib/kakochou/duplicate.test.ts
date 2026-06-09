import { describe, expect, it } from 'vitest';
import { findDuplicateBySecularName, normalizeSecularName } from './duplicate';

describe('normalizeSecularName', () => {
  it('姓名間の空白・中黒を除去する', () => {
    expect(normalizeSecularName('山田 一郎')).toBe(normalizeSecularName('山田一郎'));
    expect(normalizeSecularName('山田・一郎')).toBe(normalizeSecularName('山田一郎'));
  });

  it('前後空白をトリムする', () => {
    expect(normalizeSecularName('  山田一郎 ')).toBe(normalizeSecularName('山田一郎'));
  });
});

describe('findDuplicateBySecularName', () => {
  const candidates = [
    { id: 'a', secularName: '山田 一郎' },
    { id: 'b', secularName: '佐藤 花子' },
    { id: 'c', secularName: '山田一郎' },
  ];

  it('正規化一致する候補をすべて返す', () => {
    const hits = findDuplicateBySecularName('山田　一郎', candidates);
    expect(hits.map((c) => c.id).sort()).toEqual(['a', 'c']);
  });

  it('一致がなければ空配列', () => {
    expect(findDuplicateBySecularName('鈴木 次郎', candidates)).toEqual([]);
  });

  it('excludeId で自分自身を除外する (編集時)', () => {
    const hits = findDuplicateBySecularName('山田一郎', candidates, 'a');
    expect(hits.map((c) => c.id)).toEqual(['c']);
  });

  it('空の俗名は空配列', () => {
    expect(findDuplicateBySecularName('   ', candidates)).toEqual([]);
  });
});
