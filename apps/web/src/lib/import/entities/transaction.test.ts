import { describe, expect, it } from 'vitest';
import {
  transactionImportDef,
  type TransactionExistingIndex,
} from './transaction';

function makeIndex(households: Record<string, string> = {}): TransactionExistingIndex {
  return {
    has: () => false,
    householdIdByMatchKey: (key) => households[key] ?? null,
  };
}

const emptyIndex = makeIndex();

function toRecord(values: Record<string, string>, existing = emptyIndex) {
  return transactionImportDef.toRecord(values, { existing });
}

describe('transactionImportDef.toRecord', () => {
  it('必須が揃えばレコードを生成する', () => {
    const { issues, record } = toRecord({
      direction: '収入',
      category: '護持会費',
      amount: '10,000',
      paidAt: '2024-04-01',
    });
    expect(issues).toEqual([]);
    expect(record).not.toBeNull();
    expect(record?.direction).toBe('INCOME');
    expect(record?.category).toBe('MAINTENANCE_FEE');
    expect(record?.amount).toBe(10000);
  });

  it('金額のカンマ・円記号・全角を正規化する', () => {
    const { record } = toRecord({
      direction: '支出',
      category: '経費',
      amount: '１，２３４，５６７円',
      paidAt: '2024-04-01',
    });
    expect(record?.amount).toBe(1234567);
  });

  it('金額が数値でなければ error', () => {
    const { record, issues } = toRecord({
      direction: '収入',
      category: '御布施',
      amount: '無料',
      paidAt: '2024-04-01',
    });
    expect(record).toBeNull();
    expect(issues.some((i) => i.column === 'amount' && i.severity === 'error')).toBe(true);
  });

  it('収入に経費を指定すると整合エラー', () => {
    const { record, issues } = toRecord({
      direction: '収入',
      category: '経費',
      amount: '1000',
      paidAt: '2024-04-01',
    });
    expect(record).toBeNull();
    expect(issues.some((i) => i.column === 'category' && i.severity === 'error')).toBe(true);
  });

  it('支出に護持会費を指定すると整合エラー', () => {
    const { record, issues } = toRecord({
      direction: '支出',
      category: '護持会費',
      amount: '1000',
      paidAt: '2024-04-01',
    });
    expect(record).toBeNull();
    expect(issues.some((i) => i.column === 'category' && i.severity === 'error')).toBe(true);
  });

  it('入出金日が不完全なら error', () => {
    const { record, issues } = toRecord({
      direction: '収入',
      category: '御布施',
      amount: '1000',
      paidAt: '2024',
    });
    expect(record).toBeNull();
    expect(issues.some((i) => i.column === 'paidAt' && i.severity === 'error')).toBe(true);
  });

  it('対象世帯が一致すれば householdId を解決する', () => {
    const idx = makeIndex({ 'kana:やまだたろう': 'hh-1' });
    const { record } = toRecord(
      {
        direction: '収入',
        category: '御布施',
        amount: '5000',
        paidAt: '2024-04-01',
        householderKana: 'ヤマダタロウ',
      },
      idx,
    );
    expect(record?.householdId).toBe('hh-1');
  });

  it('対象世帯が一致しなければ警告 + 世帯なしで取り込む', () => {
    const { record, issues } = toRecord({
      direction: '収入',
      category: '御布施',
      amount: '5000',
      paidAt: '2024-04-01',
      householderName: '居ない世帯',
    });
    expect(record).not.toBeNull();
    expect(record?.householdId).toBeNull();
    expect(issues.some((i) => i.column === 'householderName' && i.severity === 'warning')).toBe(true);
  });
});
