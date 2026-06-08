import { describe, expect, it } from 'vitest';
import { validateTobaInput, type TobaInput } from './validate';

function base(overrides: Partial<TobaInput> = {}): TobaInput {
  return {
    applicantName: '山田太郎',
    targetPersonId: '',
    count: '1',
    inscription: '釋浄信',
    offeringAmount: '',
    memo: '',
    ...overrides,
  };
}

describe('validateTobaInput', () => {
  it('正常入力ではエラーなし', () => {
    const r = validateTobaInput(base());
    expect(r.errors).toEqual({});
    expect(r.count).toBe(1);
    expect(r.offeringAmount).toBeNull();
  });

  it('申込者名が空ならエラー', () => {
    const r = validateTobaInput(base({ applicantName: '' }));
    expect(r.errors.applicantName).toBeDefined();
  });

  it('表記文字列が空ならエラー', () => {
    const r = validateTobaInput(base({ inscription: '' }));
    expect(r.errors.inscription).toBeDefined();
  });

  it('本数が 0 ならエラー (最小 1)', () => {
    const r = validateTobaInput(base({ count: '0' }));
    expect(r.errors.count).toBeDefined();
  });

  it('本数が非整数ならエラー', () => {
    const r = validateTobaInput(base({ count: '2.5' }));
    expect(r.errors.count).toBeDefined();
  });

  it('複数本数を整数で受け付ける', () => {
    const r = validateTobaInput(base({ count: '3' }));
    expect(r.errors.count).toBeUndefined();
    expect(r.count).toBe(3);
  });

  it('対象故人 ID が UUID 以外ならエラー', () => {
    const r = validateTobaInput(base({ targetPersonId: 'not-a-uuid' }));
    expect(r.errors.targetPersonId).toBeDefined();
  });

  it('対象故人 ID が正しい UUID なら通る', () => {
    const r = validateTobaInput(
      base({ targetPersonId: 'a7c71b60-0fab-4cdf-9c66-0f3f7ae3e38e' }),
    );
    expect(r.errors.targetPersonId).toBeUndefined();
  });

  it('御布施額を整数で受け付け、空欄は null', () => {
    expect(validateTobaInput(base({ offeringAmount: '3000' })).offeringAmount).toBe(
      3000,
    );
    expect(validateTobaInput(base({ offeringAmount: '' })).offeringAmount).toBeNull();
  });

  it('御布施額が負ならエラー', () => {
    const r = validateTobaInput(base({ offeringAmount: '-1' }));
    expect(r.errors.offeringAmount).toBeDefined();
  });
});
