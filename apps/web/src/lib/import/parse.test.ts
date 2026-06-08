import { describe, expect, it } from 'vitest';
import { detectFileKind, parseCsv } from './parse';

describe('detectFileKind', () => {
  it('拡張子から CSV を判定する', () => {
    expect(detectFileKind('list.csv')).toBe('csv');
    expect(detectFileKind('LIST.CSV')).toBe('csv');
  });
  it('拡張子から Excel を判定する', () => {
    expect(detectFileKind('book.xlsx')).toBe('xlsx');
    expect(detectFileKind('book.xls')).toBe('xlsx');
  });
  it('非対応形式は null', () => {
    expect(detectFileKind('photo.png')).toBeNull();
    expect(detectFileKind('noext')).toBeNull();
  });
});

describe('parseCsv', () => {
  it('1行目をヘッダとして取り出す', () => {
    const sheet = parseCsv('施主名,ふりがな,電話\n山田太郎,やまだたろう,03-1111-2222');
    expect(sheet.headers).toEqual(['施主名', 'ふりがな', '電話']);
    expect(sheet.rows).toEqual([['山田太郎', 'やまだたろう', '03-1111-2222']]);
  });

  it('空ヘッダは 列N で補完する', () => {
    const sheet = parseCsv('施主名,,電話\n山田,x,03');
    expect(sheet.headers).toEqual(['施主名', '列2', '電話']);
  });

  it('引用符内のカンマを保持する', () => {
    const sheet = parseCsv('住所\n"東京都港区1,2,3"');
    expect(sheet.rows).toEqual([['東京都港区1,2,3']]);
  });

  it('空行を除去する', () => {
    const sheet = parseCsv('a,b\n\n1,2\n\n');
    expect(sheet.rows).toEqual([['1', '2']]);
  });

  it('行の長さをヘッダに揃える (不足セルは空文字)', () => {
    const sheet = parseCsv('a,b,c\n1,2');
    expect(sheet.rows[0]).toEqual(['1', '2', '']);
  });
});
