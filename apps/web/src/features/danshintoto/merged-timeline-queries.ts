import 'server-only';
import { requireCurrentTenantId } from '@/lib/auth';
import { assertValidUuid, withTenant } from '@/lib/db';
import {
  INTERACTION_CATEGORY_LABELS,
  INTERACTION_KIND_LABELS,
} from './interaction-types';

export type TimelineItemType = 'interaction' | 'memorial';

export type MergedTimelineItem = {
  type: TimelineItemType;
  id: string;
  /** ISO 文字列 (Server Component → Client/描画へ渡すため)。 */
  occurredAt: string;
  /** interaction: 種別ラベル / memorial: 法要名。 */
  title: string;
  /** interaction: 話題ラベル / memorial: null。 */
  category: string | null;
  /** 画面上のバッジ文言。interaction: '対応' / memorial: '法要'。 */
  badge: string;
};

/**
 * 指定世帯の「対応履歴 (InteractionNote)」と「法要 (MemorialService)」を
 * 1 本の時系列 (occurredAt 降順) にマージして返す。閲覧専用 (read-only)。
 *
 * - InteractionNote は論理削除 (deletedAt) されたものを除外。
 * - MemorialService は CANCELED も含む (履歴性のため)。
 * - PII 配慮: 本文 (content) は載せず、enum ラベルと法要名のみを title/category に出す。
 * - Phase 1 はそれぞれ 300 件上限。
 */
export async function buildHouseholdTimeline(
  householdId: string,
): Promise<MergedTimelineItem[]> {
  assertValidUuid(householdId, 'householdId');
  const tenantId = await requireCurrentTenantId();

  return withTenant(tenantId, async (tx) => {
    const [interactions, services] = await Promise.all([
      tx.interactionNote.findMany({
        where: { householdId, deletedAt: null },
        orderBy: { occurredAt: 'desc' },
        take: 300,
      }),
      tx.memorialService.findMany({
        where: { householdId },
        orderBy: { scheduledAt: 'desc' },
        take: 300,
      }),
    ]);

    const items: MergedTimelineItem[] = [
      ...interactions.map<MergedTimelineItem>((n) => ({
        type: 'interaction',
        id: n.id,
        occurredAt: n.occurredAt.toISOString(),
        title: INTERACTION_KIND_LABELS[n.kind],
        category: INTERACTION_CATEGORY_LABELS[n.category],
        badge: '対応',
      })),
      ...services.map<MergedTimelineItem>((s) => ({
        type: 'memorial',
        id: s.id,
        occurredAt: s.scheduledAt.toISOString(),
        title: s.serviceName,
        category: null,
        badge: '法要',
      })),
    ];

    // ISO 文字列の辞書順降順 = 時刻降順。同時刻は type で安定化。
    items.sort((a, b) => {
      const byDate = b.occurredAt.localeCompare(a.occurredAt);
      return byDate !== 0 ? byDate : a.type.localeCompare(b.type);
    });

    return items;
  });
}
