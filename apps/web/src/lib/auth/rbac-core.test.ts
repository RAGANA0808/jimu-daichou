import { describe, expect, it } from 'vitest';
import { UserRole } from '@prisma/client';
import { type Capability, can, isReadOnly } from './rbac-core';

const ALL_CAPS: Capability[] = [
  'read',
  'create',
  'update',
  'softDelete',
  'export',
  'destructive',
  'admin',
];

describe('can()', () => {
  it('HEAD_PRIEST はすべての capability を許可する (完全バイパス・締め出し厳禁)', () => {
    for (const cap of ALL_CAPS) {
      expect(can(UserRole.HEAD_PRIEST, cap)).toBe(true);
    }
  });

  it('READ_ONLY は read のみ許可し、変更系はすべて拒否する', () => {
    expect(can(UserRole.READ_ONLY, 'read')).toBe(true);
    for (const cap of ALL_CAPS.filter((c) => c !== 'read')) {
      expect(can(UserRole.READ_ONLY, cap)).toBe(false);
    }
  });

  it('STAFF は日常操作 (create/update/softDelete/export) を許可し、destructive/admin は拒否する', () => {
    expect(can(UserRole.STAFF, 'read')).toBe(true);
    expect(can(UserRole.STAFF, 'create')).toBe(true);
    expect(can(UserRole.STAFF, 'update')).toBe(true);
    expect(can(UserRole.STAFF, 'softDelete')).toBe(true);
    expect(can(UserRole.STAFF, 'export')).toBe(true);
    expect(can(UserRole.STAFF, 'destructive')).toBe(false);
    expect(can(UserRole.STAFF, 'admin')).toBe(false);
  });

  it('PRIEST は destructive まで許可し、admin のみ拒否する', () => {
    expect(can(UserRole.PRIEST, 'read')).toBe(true);
    expect(can(UserRole.PRIEST, 'create')).toBe(true);
    expect(can(UserRole.PRIEST, 'update')).toBe(true);
    expect(can(UserRole.PRIEST, 'softDelete')).toBe(true);
    expect(can(UserRole.PRIEST, 'export')).toBe(true);
    expect(can(UserRole.PRIEST, 'destructive')).toBe(true);
    expect(can(UserRole.PRIEST, 'admin')).toBe(false);
  });

  it('admin は HEAD_PRIEST だけが通る', () => {
    expect(can(UserRole.HEAD_PRIEST, 'admin')).toBe(true);
    expect(can(UserRole.PRIEST, 'admin')).toBe(false);
    expect(can(UserRole.STAFF, 'admin')).toBe(false);
    expect(can(UserRole.READ_ONLY, 'admin')).toBe(false);
  });
});

describe('isReadOnly()', () => {
  it('READ_ONLY のみ true', () => {
    expect(isReadOnly(UserRole.READ_ONLY)).toBe(true);
    expect(isReadOnly(UserRole.STAFF)).toBe(false);
    expect(isReadOnly(UserRole.PRIEST)).toBe(false);
    expect(isReadOnly(UserRole.HEAD_PRIEST)).toBe(false);
  });
});
