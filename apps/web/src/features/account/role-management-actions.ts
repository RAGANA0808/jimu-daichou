'use server';

import { UserRole } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { requireCapability } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { assertValidUuid, withTenant } from '@/lib/db';

/**
 * テナント内ユーザーの役割管理 (PERMISSION P-2)。
 *
 * - 管理操作なので admin (HEAD_PRIEST のみ)。
 * - 【締め出し防止】最後の HEAD_PRIEST の降格と、自分自身の無効化を禁止する
 *   (rbac.ts ではなくここでビジネスルールとして強制)。
 * - 新規 Supabase 認証アカウントの招待作成は Phase2 のためスコープ外
 *   (認証ブートストラップ用の RLS バイパス経路を増やさない / tenant 境界チェックを汚さない)。
 */

const VALID_ROLES = new Set<string>(Object.values(UserRole));

export type RoleManagementResult =
  | { status: 'ok' }
  | { status: 'error'; message: string };

/** テナント内ユーザーの役割を変更する。 */
export async function changeUserRoleAction(
  formData: FormData,
): Promise<RoleManagementResult> {
  const targetUserId = readField(formData, 'userId');
  if (!isUuid(targetUserId)) {
    return { status: 'error', message: '対象ユーザーの指定が不正です。' };
  }
  const nextRoleRaw = readField(formData, 'role');
  if (!VALID_ROLES.has(nextRoleRaw)) {
    return { status: 'error', message: '役割の指定が不正です。' };
  }
  const nextRole = nextRoleRaw as UserRole;

  const actor = await requireCapability('admin');
  const tenantId = actor.tenantId;

  try {
    await withTenant(tenantId, async (tx) => {
      const target = await tx.user.findUnique({
        where: { id: targetUserId },
        select: { id: true, role: true },
      });
      if (!target) {
        throw new Error('対象のユーザーが見つかりませんでした。');
      }
      if (target.role === nextRole) return; // 変化なし: 冪等

      // 締め出し防止: 最後の HEAD_PRIEST を降格させない。
      if (target.role === UserRole.HEAD_PRIEST && nextRole !== UserRole.HEAD_PRIEST) {
        const headCount = await tx.user.count({
          where: { role: UserRole.HEAD_PRIEST, isActive: true },
        });
        if (headCount <= 1) {
          throw new Error(
            '最後の住職を降格することはできません。先に別のユーザーを住職にしてください。',
          );
        }
      }

      await tx.user.update({
        where: { id: targetUserId },
        data: { role: nextRole },
      });

      await recordAudit(tx, tenantId, {
        actorId: actor.id,
        action: 'ROLE_CHANGE',
        entityType: 'User',
        entityId: targetUserId,
        summary: `役割を ${target.role}→${nextRole} に変更`,
      });
    });
  } catch (err) {
    return {
      status: 'error',
      message:
        err instanceof Error ? err.message : '役割の変更に失敗しました。',
    };
  }

  revalidatePath('/settings/roles');
  return { status: 'ok' };
}

/** テナント内ユーザーの有効/無効を切り替える。 */
export async function toggleUserActiveAction(
  formData: FormData,
): Promise<RoleManagementResult> {
  const targetUserId = readField(formData, 'userId');
  if (!isUuid(targetUserId)) {
    return { status: 'error', message: '対象ユーザーの指定が不正です。' };
  }

  const actor = await requireCapability('admin');
  const tenantId = actor.tenantId;

  // 締め出し防止: 自分自身の無効化を禁止 (最後の管理者ロックアウト回避の一段目)。
  if (targetUserId === actor.id) {
    return {
      status: 'error',
      message: 'ご自身のアカウントは無効化できません。',
    };
  }

  try {
    await withTenant(tenantId, async (tx) => {
      const target = await tx.user.findUnique({
        where: { id: targetUserId },
        select: { id: true, role: true, isActive: true },
      });
      if (!target) {
        throw new Error('対象のユーザーが見つかりませんでした。');
      }
      const nextActive = !target.isActive;

      // 締め出し防止: 最後の有効な HEAD_PRIEST を無効化させない。
      if (
        target.isActive &&
        target.role === UserRole.HEAD_PRIEST
      ) {
        const headCount = await tx.user.count({
          where: { role: UserRole.HEAD_PRIEST, isActive: true },
        });
        if (headCount <= 1) {
          throw new Error(
            '最後の住職を無効化することはできません。先に別のユーザーを住職にしてください。',
          );
        }
      }

      await tx.user.update({
        where: { id: targetUserId },
        data: { isActive: nextActive },
      });

      await recordAudit(tx, tenantId, {
        actorId: actor.id,
        action: 'ROLE_CHANGE',
        entityType: 'User',
        entityId: targetUserId,
        summary: `アカウントを${nextActive ? '有効化' : '無効化'}`,
      });
    });
  } catch (err) {
    return {
      status: 'error',
      message:
        err instanceof Error ? err.message : '状態の変更に失敗しました。',
    };
  }

  revalidatePath('/settings/roles');
  return { status: 'ok' };
}

function readField(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === 'string' ? v.trim() : '';
}

function isUuid(v: string): boolean {
  try {
    assertValidUuid(v, 'userId');
    return true;
  } catch {
    return false;
  }
}
