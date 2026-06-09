import { UserRole } from '@prisma/client';

/** ユーザー役割の日本語表示ラベル。 */
export const USER_ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.HEAD_PRIEST]: '住職',
  [UserRole.PRIEST]: '僧侶',
  [UserRole.STAFF]: '事務員',
  [UserRole.READ_ONLY]: '閲覧のみ',
};

export function userRoleLabel(role: UserRole): string {
  return USER_ROLE_LABELS[role];
}
