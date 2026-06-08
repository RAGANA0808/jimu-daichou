import { describe, expect, it } from 'vitest';
import { buildAddressCsv, escapeCsvCell, ADDRESS_CSV_HEADER } from './csv';

describe('escapeCsvCell', () => {
  it('特殊文字を含まないセルはそのまま', () => {
    expect(escapeCsvCell('山田太郎')).toBe('山田太郎');
  });
  it('カンマを含むセルは引用符で囲む', () => {
    expect(escapeCsvCell('東京都港区1,2,3')).toBe('"東京都港区1,2,3"');
  });
  it('ダブルクォートは "" にエスケープして囲む', () => {
    expect(escapeCsvCell('a"b')).toBe('"a""b"');
  });
  it('改行を含むセルは引用符で囲む', () => {
    expect(escapeCsvCell('a\nb')).toBe('"a\nb"');
  });
});

describe('buildAddressCsv', () => {
  it('ヘッダ行 + 各宛先行を CRLF 区切りで返す', () => {
    const csv = buildAddressCsv([
      {
        householderName: '山田太郎',
        postalCode: '100-0001',
        address: '東京都千代田区1-1',
        summary: '山田花子 三回忌',
      },
    ]);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe(ADDRESS_CSV_HEADER.join(','));
    expect(lines[1]).toBe('山田太郎,様,100-0001,東京都千代田区1-1,山田花子 三回忌');
  });

  it('null フィールドは空セルになる', () => {
    const csv = buildAddressCsv([
      { householderName: '佐藤', postalCode: null, address: null, summary: null },
    ]);
    expect(csv.split('\r\n')[1]).toBe('佐藤,様,,,');
  });

  it('カンマを含む住所はエスケープされる', () => {
    const csv = buildAddressCsv([
      { householderName: '鈴木', postalCode: null, address: 'A,B', summary: null },
    ]);
    expect(csv.split('\r\n')[1]).toBe('鈴木,様,,"A,B",');
  });
});
