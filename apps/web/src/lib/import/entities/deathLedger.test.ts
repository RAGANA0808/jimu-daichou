import { describe, expect, it } from 'vitest';
import { guessMapping } from '../mapping';
import { evaluateSheet, collectInsertableRecords } from '../evaluate';
import {
  deathLedgerImportDef,
  type DeathLedgerExistingIndex,
} from './deathLedger';
import type { ParsedSheet } from '../types';

function makeIndex(opts: {
  households?: Record<string, string>;
  duplicates?: string[];
}): DeathLedgerExistingIndex {
  const households = opts.households ?? {};
  const dups = new Set(opts.duplicates ?? []);
  return {
    has: (key) => dups.has(key),
    householdIdByMatchKey: (key) => households[key] ?? null,
  };
}

const headers = ['俗名', 'ふりがな', '戒名', '没年月日', '行年', '施主名'];

function sheetOf(rows: string[][]): ParsedSheet {
  return { headers, rows };
}

const mapping = guessMapping(headers, deathLedgerImportDef.columns);

describe('deathLedgerImportDef.toRecord', () => {
  it('施主名が既存世帯と一致すればその世帯へ紐づける', () => {
    const existing = makeIndex({ households: { 'name:やまだたろう': 'hh-1' } });
    const sheet = sheetOf([
      ['山田一郎', 'やまだいちろう', '釈道心', '令和6年3月15日', '88', 'やまだたろう'],
    ]);
    const preview = evaluateSheet(sheet, mapping, deathLedgerImportDef, existing);
    expect(preview.counts.ok).toBe(1);
    const recs = collectInsertableRecords(preview);
    expect(recs[0]?.household).toEqual({ kind: 'existing', householdId: 'hh-1' });
    expect(recs[0]?.deathDate.precision).toBe('FULL');
    expect(recs[0]?.ageAtDeath).toBe(88);
  });

  it('一致世帯が無ければ新規世帯として記録する', () => {
    const existing = makeIndex({});
    const sheet = sheetOf([
      ['佐藤花子', 'さとうはなこ', '', '2020', '', '佐藤太郎'],
    ]);
    const recs = collectInsertableRecords(
      evaluateSheet(sheet, mapping, deathLedgerImportDef, existing),
    );
    expect(recs[0]?.household).toEqual({
      kind: 'new',
      householderName: '佐藤太郎',
      nameKana: '佐藤太郎',
    });
    expect(recs[0]?.deathDate.precision).toBe('YEAR');
  });

  it('施主名が無い行はエラー (世帯を特定できない)', () => {
    const existing = makeIndex({});
    const sheet = sheetOf([['田中次郎', 'たなかじろう', '', '2021', '', '']]);
    const preview = evaluateSheet(sheet, mapping, deathLedgerImportDef, existing);
    expect(preview.counts.error).toBe(1);
    expect(preview.rows[0]?.record).toBeNull();
  });

  it('俗名が無い行はエラー', () => {
    const existing = makeIndex({});
    const sheet = sheetOf([['', '', '', '2021', '', '鈴木家']]);
    const preview = evaluateSheet(sheet, mapping, deathLedgerImportDef, existing);
    expect(preview.counts.error).toBe(1);
  });

  it('既存世帯+同名故人は重複 warning でスキップ', () => {
    const existing = makeIndex({
      households: { 'name:やまだたろう': 'hh-1' },
      duplicates: ['dup:hh-1:山田一郎'],
    });
    const sheet = sheetOf([
      ['山田一郎', 'やまだいちろう', '', '2024', '', 'やまだたろう'],
    ]);
    const preview = evaluateSheet(sheet, mapping, deathLedgerImportDef, existing);
    expect(preview.counts.warning).toBe(1);
    expect(preview.rows[0]?.record).toBeNull();
  });

  it('没年月日が読み取れない行はエラー', () => {
    const existing = makeIndex({ households: { 'name:鈴木家': 'hh-2' } });
    const sheet = sheetOf([
      ['鈴木一', 'すずきはじめ', '', 'いつかの春', '', '鈴木家'],
    ]);
    const preview = evaluateSheet(sheet, mapping, deathLedgerImportDef, existing);
    expect(preview.counts.error).toBe(1);
  });

  it('ふりがな未入力なら俗名を仮のふりがなにする', () => {
    const existing = makeIndex({ households: { 'name:いえ': 'hh-3' } });
    const sheet = sheetOf([['故人甲', '', '', '不明', '', 'いえ']]);
    const recs = collectInsertableRecords(
      evaluateSheet(sheet, mapping, deathLedgerImportDef, existing),
    );
    expect(recs[0]?.nameKana).toBe('故人甲');
    expect(recs[0]?.deathDate.precision).toBe('UNKNOWN');
  });
});
