import 'server-only';
import type { UserRole } from '@prisma/client';
import { requireCurrentUser } from '@/lib/auth';
import { withTenant } from '@/lib/db';

export type TenantUserRow = {
  id: string;
  displayName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  isSelf: boolean;
};

/**
 * テナント内のユーザー一覧を返す (役割管理画面用)。
 * withTenant + RLS で自テナントのユーザーのみに限定される。
 */
export async function listTenantUsers(): Promise<TenantUserRow[]> {
  const me = await requireCurrentUser();
  const rows = await withTenant(me.tenantId, (tx) =>
    tx.user.findMany({
      orderBy: [{ isActive: 'desc' }, { role: 'asc' }, { displayName: 'asc' }],
      select: {
        id: true,
        displayName: true,
        email: true,
        role: true,
        isActive: true,
      },
      take: 500,
    }),
  );
  return rows.map((u) => ({ ...u, isSelf: u.id === me.id }));
}
