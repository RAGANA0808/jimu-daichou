import 'server-only';
import type { AuditAction, UserRole } from '@prisma/client';
import { requireCurrentTenantId } from '@/lib/auth';
import { withTenant } from '@/lib/db';

export type AuditLogRow = {
  id: string;
  action: AuditAction;
  entityType: string;
  entityId: string | null;
  summary: string;
  createdAt: Date;
  actorName: string | null;
  actorRole: UserRole | null;
};

const DEFAULT_TAKE = 100;

/**
 * 監査ログを新しい順に取得する (既定 100 件)。
 * actor は表示用に displayName / role のみ include する (個人情報は summary に載せない方針)。
 */
export async function listAuditLogs(take = DEFAULT_TAKE): Promise<AuditLogRow[]> {
  const tenantId = await requireCurrentTenantId();
  const rows = await withTenant(tenantId, (tx) =>
    tx.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        summary: true,
        createdAt: true,
        actor: { select: { displayName: true, role: true } },
      },
    }),
  );

  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    entityType: r.entityType,
    entityId: r.entityId,
    summary: r.summary,
    createdAt: r.createdAt,
    actorName: r.actor?.displayName ?? null,
    actorRole: r.actor?.role ?? null,
  }));
}
