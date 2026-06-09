import { describe, expect, it } from 'vitest';
import {
  StaleError,
  assertNotStale,
  isStaleError,
  toOptimisticToken,
} from './optimistic';

describe('toOptimisticToken', () => {
  it('epoch ms 文字列を返す', () => {
    expect(toOptimisticToken(new Date(0))).toBe('0');
    expect(toOptimisticToken(new Date(1717804800000))).toBe('1717804800000');
  });
});

describe('assertNotStale', () => {
  it('トークンと updatedAt が一致すれば throw しない', () => {
    expect(() => assertNotStale('100', new Date(100))).not.toThrow();
  });

  it('不一致なら StaleError を throw する', () => {
    expect(() => assertNotStale('100', new Date(200))).toThrow(StaleError);
  });
});

describe('isStaleError', () => {
  it('StaleError インスタンスは true', () => {
    expect(isStaleError(new StaleError())).toBe(true);
  });

  it('マーカープロパティを持つプレーンオブジェクトも true (境界越え対策)', () => {
    expect(isStaleError({ isStaleError: true })).toBe(true);
  });

  it('通常の Error は false', () => {
    expect(isStaleError(new Error('boom'))).toBe(false);
  });

  it('null は false', () => {
    expect(isStaleError(null)).toBe(false);
  });
});
