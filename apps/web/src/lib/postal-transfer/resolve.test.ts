import { describe, expect, it } from 'vitest';
import { resolveSubjectLines, type SubjectTemplate } from './resolve';

const subjects: SubjectTemplate[] = [
  {
    id: 's1',
    name: '護持会費',
    defaultAmount: 8000,
    isVisible: true,
    amountSource: 'MAINTENANCE_FEE',
  },
  {
    id: 's2',
    name: '墓地管理費',
    defaultAmount: 3000,
    isVisible: true,
    amountSource: 'GRAVE_MAINTENANCE',
  },
  {
    id: 's3',
    name: 'お布施',
    defaultAmount: 5000,
    isVisible: true,
    amountSource: 'NONE',
  },
  {
    id: 's4',
    name: '非表示科目',
    defaultAmount: 1000,
    isVisible: false,
    amountSource: 'NONE',
  },
];

describe('resolveSubjectLines', () => {
  it('連動元の当年度請求額を優先し、無い科目は既定額を使う', () => {
    const lines = resolveSubjectLines(subjects, {
      MAINTENANCE_FEE: 10000,
      // GRAVE_MAINTENANCE は欠落 → defaultAmount=3000 にフォールバック
    });
    expect(lines).toEqual([
      { subjectId: 's1', name: '護持会費', amount: 10000 },
      { subjectId: 's2', name: '墓地管理費', amount: 3000 },
      { subjectId: 's3', name: 'お布施', amount: 5000 },
    ]);
  });

  it('isVisible=false の科目は除外する', () => {
    const lines = resolveSubjectLines(subjects, {});
    expect(lines.map((l) => l.subjectId)).not.toContain('s4');
  });

  it('NONE 科目は常に defaultAmount', () => {
    const lines = resolveSubjectLines(subjects, { MAINTENANCE_FEE: 99999 });
    const ofuse = lines.find((l) => l.subjectId === 's3');
    expect(ofuse?.amount).toBe(5000);
  });
});
