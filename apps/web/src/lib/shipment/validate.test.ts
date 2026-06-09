import { describe, expect, it } from 'vitest';
import {
  parseLocalDate,
  parseLocalDateTime,
  validateShipmentInput,
  type ShipmentInput,
} from './validate';

function base(overrides: Partial<ShipmentInput> = {}): ShipmentInput {
  return {
    title: '2026年 年忌法要のご案内',
    documentType: 'NOTICE_LETTER',
    serviceDate: '',
    location: '',
    offeringGuide: '',
    replyDeadline: '',
    bodyNote: '',
    ...overrides,
  };
}

describe('parseLocalDateTime', () => {
  it('正しい形式を JST ローカルとして解釈する', () => {
    const d = parseLocalDateTime('2026-06-15T10:30');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth() + 1).toBe(6);
    expect(d!.getDate()).toBe(15);
    expect(d!.getHours()).toBe(10);
    expect(d!.getMinutes()).toBe(30);
  });
  it('存在しない日付は null', () => {
    expect(parseLocalDateTime('2026-02-30T10:00')).toBeNull();
  });
  it('形式違いは null', () => {
    expect(parseLocalDateTime('2026/06/15 10:30')).toBeNull();
  });
});

describe('parseLocalDate', () => {
  it('正しい日付を解釈する', () => {
    const d = parseLocalDate('2026-06-30');
    expect(d!.getDate()).toBe(30);
  });
  it('存在しない日付は null', () => {
    expect(parseLocalDate('2026-13-01')).toBeNull();
  });
});

describe('validateShipmentInput', () => {
  it('最小入力 (発送名のみ) で通る', () => {
    const r = validateShipmentInput(base());
    expect(r.errors).toEqual({});
    expect(r.values.title).toBe('2026年 年忌法要のご案内');
    expect(r.values.serviceDate).toBeNull();
  });

  it('発送名が空ならエラー', () => {
    const r = validateShipmentInput(base({ title: '   ' }));
    expect(r.errors.title).toBeDefined();
  });

  it('不正な documentType はエラー', () => {
    const r = validateShipmentInput(base({ documentType: 'FOO' }));
    expect(r.errors.documentType).toBeDefined();
  });

  it('差込項目を正規化し Date に変換する', () => {
    const r = validateShipmentInput(
      base({
        serviceDate: '2026-06-15T13:00',
        location: '本堂',
        offeringGuide: '一万円',
        replyDeadline: '2026-06-01',
        bodyNote: 'ご都合をお知らせください',
      }),
    );
    expect(r.errors).toEqual({});
    expect(r.values.serviceDate).toBeInstanceOf(Date);
    expect(r.values.location).toBe('本堂');
    expect(r.values.offeringGuide).toBe('一万円');
    expect(r.values.replyDeadline).toBeInstanceOf(Date);
    expect(r.values.bodyNote).toBe('ご都合をお知らせください');
  });

  it('不正な日時形式はフィールドエラー', () => {
    const r = validateShipmentInput(base({ serviceDate: 'bad' }));
    expect(r.errors.serviceDate).toBeDefined();
  });

  it('空欄の任意項目は null になる', () => {
    const r = validateShipmentInput(base({ location: '  ' }));
    expect(r.values.location).toBeNull();
  });
});
