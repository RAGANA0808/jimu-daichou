import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import {
  csvToBytes,
  extensionFor,
  mimeTypeFor,
  toCsv,
  toXlsx,
} from './serialize';

describe('toCsv', () => {
  it('BOM 付き UTF-8 で先頭にヘッダ行を出す', () => {
    const csv = toCsv(['名前', '電話'], [['山田', '090-1']]);
    expect(csv.charCodeAt(0)).toBe(0xfeff); // BOM
    expect(csv).toContain('名前,電話');
  });

  it('改行は CRLF', () => {
    const csv = toCsv(['a'], [['1'], ['2']]);
    expect(csv).toContain('a\r\n1\r\n2');
  });

  it('カンマ・ダブルクォート・改行を含むセルを引用符でエスケープ', () => {
    const csv = toCsv(['memo'], [['a,b']]);
    expect(csv).toContain('"a,b"');

    const csv2 = toCsv(['memo'], [['say "hi"']]);
    expect(csv2).toContain('"say ""hi"""');

    const csv3 = toCsv(['memo'], [['line1\nline2']]);
    expect(csv3).toContain('"line1\nline2"');
  });

  it('引用不要なセルはそのまま出す', () => {
    const csv = toCsv(['a'], [['plain']]);
    expect(csv).toContain('\r\nplain');
    expect(csv).not.toContain('"plain"');
  });
});

describe('csvToBytes', () => {
  it('UTF-8 バイト列へ変換する', () => {
    const bytes = csvToBytes('A');
    expect(bytes[0]).toBe(0x41);
  });
});

describe('toXlsx', () => {
  it('読み戻すとヘッダ + 行が一致する', () => {
    const bytes = toXlsx(['名前', '金額'], [['山田', '1000'], ['田中', '2000']], '会計');
    const wb = XLSX.read(bytes, { type: 'array' });
    const sheetName = wb.SheetNames[0];
    expect(sheetName).toBe('会計');
    const sheet = wb.Sheets[sheetName as string];
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet as XLSX.WorkSheet, { header: 1 });
    expect(rows[0]).toEqual(['名前', '金額']);
    expect(rows[1]).toEqual(['山田', '1000']);
    expect(rows[2]).toEqual(['田中', '2000']);
  });

  it('前ゼロの値を文字列として保つ (桁落ちしない)', () => {
    const bytes = toXlsx(['code'], [['007']], 'sheet');
    const wb = XLSX.read(bytes, { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0] as string] as XLSX.WorkSheet;
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false });
    expect(rows[1]).toEqual(['007']);
  });

  it('禁止文字を含むシート名は安全化される', () => {
    const bytes = toXlsx(['a'], [['1']], 'a/b:c*d');
    const wb = XLSX.read(bytes, { type: 'array' });
    expect(wb.SheetNames[0]).toBe('a_b_c_d');
  });
});

describe('mimeTypeFor / extensionFor', () => {
  it('CSV', () => {
    expect(mimeTypeFor('csv')).toContain('text/csv');
    expect(extensionFor('csv')).toBe('csv');
  });
  it('XLSX', () => {
    expect(mimeTypeFor('xlsx')).toContain('spreadsheetml');
    expect(extensionFor('xlsx')).toBe('xlsx');
  });
});
