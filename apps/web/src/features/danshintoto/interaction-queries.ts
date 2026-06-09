import 'server-only';
import type { InteractionNote } from '@prisma/client';
import { requireCurrentTenantId } from '@/lib/auth';
import { assertValidUuid, withTenant } from '@/lib/db';

export type InteractionNoteWithAuthor = InteractionNote & {
  /** 記録者の表示名。authorId が未設定/解決不能なら null。 */
  authorName: string | null;
};

/** displayName 未設定 (空/空白) のユーザー向けフォールバック表示。 */
const UNNAMED_AUTHOR_LABEL = '（名前未設定）';

/**
 * displayName を記録者表示用に解決する。
 * authorId 未設定/解決不能なら null、displayName が空/空白なら「（名前未設定）」。
 * メールアドレスは記録者として画面に出さない方針のため、ここでも一切参照しない。
 */
function resolveAuthorName(
  authorId: string | null,
  nameById: Map<string, string>,
): string | null {
  if (!authorId) {
    return null;
  }
  if (!nameById.has(authorId)) {
    return null;
  }
  const displayName = nameById.get(authorId) ?? '';
  return displayName.trim().length > 0 ? displayName : UNNAMED_AUTHOR_LABEL;
}

/**
 * 指定世帯の対応履歴を occurredAt 降順 (時系列タイムライン) で取得する。
 * 論理削除 (deletedAt) されたものは表示しない。
 * 記録者名は同一トランザクション内で User を引いて付与する。
 * Phase 1 は 300 件上限 (1 世帯で 300 件超は想定外)。
 */
export async function listInteractionNotesByHousehold(
  householdId: string,
): Promise<InteractionNoteWithAuthor[]> {
  assertValidUuid(householdId, 'householdId');
  const tenantId = await requireCurrentTenantId();

  return withTenant(tenantId, async (tx) => {
    const notes = await tx.interactionNote.findMany({
      where: { householdId, deletedAt: null },
      orderBy: [
        { isPinned: 'desc' },
        { occurredAt: 'desc' },
        { createdAt: 'desc' },
      ],
      take: 300,
    });

    const authorIds = Array.from(
      new Set(
        notes
          .map((n) => n.authorId)
          .filter((id): id is string => id !== null),
      ),
    );

    const authors =
      authorIds.length > 0
        ? await tx.user.findMany({
            where: { id: { in: authorIds } },
            select: { id: true, displayName: true },
          })
        : [];
    const nameById = new Map(authors.map((u) => [u.id, u.displayName]));

    return notes.map((n) => ({
      ...n,
      authorName: resolveAuthorName(n.authorId, nameById),
    }));
  });
}

export type RecentInteractionNote = InteractionNoteWithAuthor & {
  household: { id: string; householderName: string };
};

/**
 * ダッシュボード用: テナント内の対応履歴を世帯横断で occurredAt 降順に取得する。
 * 論理削除 (deletedAt) されたものは除外。個人情報は世帯名のみに絞り、メール等は露出しない。
 */
export async function listRecentInteractionNotes(
  limit = 8,
): Promise<RecentInteractionNote[]> {
  const tenantId = await requireCurrentTenantId();

  return withTenant(tenantId, async (tx) => {
    const notes = await tx.interactionNote.findMany({
      where: { deletedAt: null },
      include: {
        household: { select: { id: true, householderName: true } },
      },
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });

    const authorIds = Array.from(
      new Set(
        notes
          .map((n) => n.authorId)
          .filter((id): id is string => id !== null),
      ),
    );
    const authors =
      authorIds.length > 0
        ? await tx.user.findMany({
            where: { id: { in: authorIds } },
            select: { id: true, displayName: true },
          })
        : [];
    const nameById = new Map(authors.map((u) => [u.id, u.displayName]));

    return notes.map((n) => ({
      ...n,
      authorName: resolveAuthorName(n.authorId, nameById),
    }));
  });
}

/**
 * 単一の対応履歴を取得 (編集フォームのプリセット用)。
 * 論理削除済み・他テナントのものは null。
 */
export async function getInteractionNoteById(
  id: string,
): Promise<InteractionNote | null> {
  assertValidUuid(id, 'interactionNoteId');
  const tenantId = await requireCurrentTenantId();
  return withTenant(tenantId, (tx) =>
    tx.interactionNote.findFirst({
      where: { id, deletedAt: null },
    }),
  );
}
