import { describe, expect, it } from 'vitest';
import { assertValidUuid, isValidUuid } from './uuid';

describe('isValidUuid', () => {
  it('正しい UUID v4 は true', () => {
    expect(isValidUuid('a7c71b60-0fab-4cdf-9c66-0f3f7ae3e38e')).toBe(true);
  });

  it('大文字でも true', () => {
    expect(isValidUuid('A7C71B60-0FAB-4CDF-9C66-0F3F7AE3E38E')).toBe(true);
  });

  it('空文字は false', () => {
    expect(isValidUuid('')).toBe(false);
  });

  it('SQL インジェクション試行は false', () => {
    expect(isValidUuid("'; DROP TABLE users; --")).toBe(false);
  });

  it('波括弧付きは false (Windows GUID 形式は非対応)', () => {
    expect(isValidUuid('{a7c71b60-0fab-4cdf-9c66-0f3f7ae3e38e}')).toBe(false);
  });

  it('ハイフンなしは false', () => {
    expect(isValidUuid('a7c71b600fab4cdf9c660f3f7ae3e38e')).toBe(false);
  });

  it('桁数不足は false', () => {
    expect(isValidUuid('a7c71b60-0fab-4cdf-9c66-0f3f7ae3e38')).toBe(false);
  });
});

describe('assertValidUuid', () => {
  it('正しい UUID は throw しない', () => {
    expect(() => assertValidUuid('a7c71b60-0fab-4cdf-9c66-0f3f7ae3e38e')).not.toThrow();
  });

  it('不正な入力は TypeError', () => {
    expect(() => assertValidUuid('not-a-uuid')).toThrow(TypeError);
  });

  it('fieldName がメッセージに含まれる', () => {
    expect(() => assertValidUuid('x', 'tenantId')).toThrow(/tenantId/);
  });
});
