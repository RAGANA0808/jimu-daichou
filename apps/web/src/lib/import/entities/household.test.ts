import { describe, expect, it } from 'vitest';
import { householdImportDef, type HouseholdImportRecord } from './household';
import { makeKeyIndex } from '../evaluate';
import type { ExistingKeyIndex } from '../types';

const emptyExisting: ExistingKeyIndex = makeKeyIndex([]);

function toRecord(values: Record<string, string>, existing = emptyExisting) {
  return householdImportDef.toRecord(values, { existing });
}

describe('householdImportDef.toRecord', () => {
  it('必須が揃えばレコードを生成する', () => {
    const { issues, record } = toRecord({
      householderName: '山田太郎',
      nameKana: 'やまだたろう',
      phone: '03-1111-2222',
    });
    expect(issues).toEqual([]);
    expect(record).not.toBeNull();
    expect(record?.householderName).toBe('山田太郎');
    expect(record?.phone).toBe('03-1111-2222');
  });

  it('施主名が空なら error で record=null', () => {
    const { issues, record } = toRecord({ householderName: '', nameKana: 'かな' });
    expect(record).toBeNull();
    expect(issues.some((i) => i.column === 'householderName' && i.severity === 'error')).toBe(true);
  });

  it('ふりがなが空なら error', () => {
    const { issues, record } = toRecord({ householderName: '山田', nameKana: '' });
    expect(record).toBeNull();
    expect(issues.some((i) => i.column === 'nameKana' && i.severity === 'error')).toBe(true);
  });

  it('メール形式不正は warning (error ではない)', () => {
    const { issues, record } = toRecord({
      householderName: '山田',
      nameKana: 'やまだ',
      email: 'invalid-email',
    });
    expect(record).not.toBeNull();
    expect(issues.some((i) => i.column === 'email' && i.severity === 'warning')).toBe(true);
  });

  it('既存とふりがなが一致すると重複 warning + スキップ (record=null)', () => {
    const existing = makeKeyIndex(['kana:やまだたろう']);
    const { issues, record } = toRecord(
      { householderName: '山田太郎', nameKana: 'ヤマダタロウ' },
      existing,
    );
    expect(record).toBeNull();
    expect(issues.some((i) => i.severity === 'warning' && i.message.includes('ふりがな'))).toBe(true);
  });

  it('既存と電話が一致すると重複 warning (ハイフン差は無視)', () => {
    const existing = makeKeyIndex(['phone:09012345678']);
    const { issues, record } = toRecord(
      { householderName: '佐藤', nameKana: 'さとう', mobile: '090-1234-5678' },
      existing,
    );
    expect(record).toBeNull();
    expect(issues.some((i) => i.message.includes('電話番号'))).toBe(true);
  });

  it('家族構成員を「氏名:ふりがな:続柄」で取り込む', () => {
    const { record } = toRecord({
      householderName: '山田太郎',
      nameKana: 'やまだたろう',
      familyMembers: '山田花子:やまだはなこ:配偶者；山田一郎:やまだいちろう:長男',
    });
    expect(record?.persons).toHaveLength(2);
    expect(record?.persons[0]).toEqual({
      name: '山田花子',
      nameKana: 'やまだはなこ',
      familyRelation: '配偶者',
    });
    expect(record?.persons[1]?.familyRelation).toBe('長男');
  });

  it('家族構成員のふりがな省略時は氏名で代替する', () => {
    const { record } = toRecord({
      householderName: '山田',
      nameKana: 'やまだ',
      familyMembers: '花子',
    });
    expect(record?.persons[0]).toEqual({
      name: '花子',
      nameKana: '花子',
      familyRelation: null,
    });
  });

  it('任意項目は空なら null に正規化する', () => {
    const { record } = toRecord({
      householderName: '山田',
      nameKana: 'やまだ',
      postalCode: '',
      address: '   ',
    });
    const r = record as HouseholdImportRecord;
    expect(r.postalCode).toBeNull();
    expect(r.address).toBeNull();
  });
});
