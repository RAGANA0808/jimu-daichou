import { describe, expect, it } from 'vitest';
import { chunk, collectInsertableRecords, evaluateSheet, makeKeyIndex } from './evaluate';
import { householdImportDef } from './entities/household';
import { guessMapping } from './mapping';
import type { ParsedSheet } from './types';

describe('chunk', () => {
  it('指定サイズで分割する', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
  it('size<=0 は分割しない', () => {
    expect(chunk([1, 2], 0)).toEqual([[1, 2]]);
  });
});

describe('evaluateSheet', () => {
  const sheet: ParsedSheet = {
    headers: ['施主名', 'ふりがな', '電話'],
    rows: [
      ['山田太郎', 'やまだたろう', '03-1111-2222'], // ok
      ['', 'かなのみ', ''], // error (施主名なし)
      ['佐藤花子', 'さとうはなこ', '090-1234-5678'], // 重複 warning
    ],
  };
  const mapping = guessMapping(sheet.headers, householdImportDef.columns);
  const existing = makeKeyIndex(['phone:09012345678']);

  it('行ごとに severity と record を判定する', () => {
    const preview = evaluateSheet(sheet, mapping, householdImportDef, existing);
    expect(preview.counts.total).toBe(3);
    expect(preview.counts.ok).toBe(1);
    expect(preview.counts.error).toBe(1);
    expect(preview.counts.warning).toBe(1);
    expect(preview.rows[0]?.record).not.toBeNull();
    expect(preview.rows[1]?.record).toBeNull();
    expect(preview.rows[2]?.record).toBeNull(); // 重複はスキップ
  });

  it('collectInsertableRecords は error/重複を除いた行のみ返す', () => {
    const preview = evaluateSheet(sheet, mapping, householdImportDef, existing);
    const records = collectInsertableRecords(preview);
    expect(records).toHaveLength(1);
    expect(records[0]?.householderName).toBe('山田太郎');
  });
});
