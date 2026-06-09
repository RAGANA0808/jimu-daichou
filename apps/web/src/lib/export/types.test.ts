import { describe, expect, it } from 'vitest';
import { buildTable } from './types';
import type { ExportColumn } from './types';

const columns: ExportColumn[] = [
  { key: 'name', label: '名前' },
  { key: 'phone', label: '電話' },
];

describe('buildTable', () => {
  it('列順にヘッダと行を組み立てる', () => {
    const { headers, rows } = buildTable(columns, [
      { name: '山田', phone: '090' },
      { name: '田中', phone: '080' },
    ]);
    expect(headers).toEqual(['名前', '電話']);
    expect(rows).toEqual([
      ['山田', '090'],
      ['田中', '080'],
    ]);
  });

  it('欠けたキーは空文字で埋める', () => {
    const { rows } = buildTable(columns, [{ name: '山田' }]);
    expect(rows).toEqual([['山田', '']]);
  });

  it('レコードが空なら行は空配列', () => {
    const { headers, rows } = buildTable(columns, []);
    expect(headers).toEqual(['名前', '電話']);
    expect(rows).toEqual([]);
  });
});
