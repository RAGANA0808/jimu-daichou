import { describe, expect, it } from 'vitest';
import { applyMapping, findUnmappedRequired, guessMapping } from './mapping';
import type { ColumnDef } from './types';

const columns: ColumnDef[] = [
  { key: 'householderName', label: '施主名', required: true, aliases: ['氏名', '名前'] },
  { key: 'nameKana', label: 'ふりがな', required: true, aliases: ['かな', 'カナ'] },
  { key: 'phone', label: '電話番号', required: false, aliases: ['電話', 'tel'] },
];

describe('guessMapping', () => {
  it('完全一致のヘッダを割り当てる', () => {
    const m = guessMapping(['施主名', 'ふりがな', '電話番号'], columns);
    expect(m.householderName).toBe(0);
    expect(m.nameKana).toBe(1);
    expect(m.phone).toBe(2);
  });

  it('別名・表記ゆれ (全角/括弧/英語) を吸収する', () => {
    const m = guessMapping(['氏名', 'カナ', 'TEL'], columns);
    expect(m.householderName).toBe(0);
    expect(m.nameKana).toBe(1);
    expect(m.phone).toBe(2);
  });

  it('未一致の項目は null になる', () => {
    const m = guessMapping(['全く関係ない列'], columns);
    expect(m.householderName).toBeNull();
    expect(m.nameKana).toBeNull();
    expect(m.phone).toBeNull();
  });

  it('同じ列を複数項目に二重割当しない', () => {
    // "名前" は householderName(別名) と nameKana のどちらにも部分マッチしうるが 1 度だけ
    const m = guessMapping(['名前', '読み'], [
      { key: 'householderName', label: '施主名', required: true, aliases: ['名前'] },
      { key: 'other', label: 'その他', required: false, aliases: ['名前'] },
    ]);
    const usedIndices = Object.values(m).filter((v) => v !== null);
    expect(new Set(usedIndices).size).toBe(usedIndices.length);
  });
});

describe('applyMapping', () => {
  it('マッピングに従い行から値を取り出す', () => {
    const m = { householderName: 0, nameKana: 1, phone: null };
    const out = applyMapping(['山田太郎', 'やまだたろう', '03-1111-2222'], columns, m);
    expect(out.householderName).toBe('山田太郎');
    expect(out.nameKana).toBe('やまだたろう');
    expect(out.phone).toBe('');
  });
});

describe('findUnmappedRequired', () => {
  it('必須未割当を検出する', () => {
    const m = { householderName: 0, nameKana: null, phone: null };
    const missing = findUnmappedRequired(columns, m);
    expect(missing.map((c) => c.key)).toEqual(['nameKana']);
  });

  it('全必須が割当済みなら空', () => {
    const m = { householderName: 0, nameKana: 1, phone: null };
    expect(findUnmappedRequired(columns, m)).toEqual([]);
  });
});
