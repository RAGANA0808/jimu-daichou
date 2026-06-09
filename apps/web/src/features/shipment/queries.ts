import 'server-only';
import { requireCurrentTenantId } from '@/lib/auth';
import { assertValidUuid, withTenant } from '@/lib/db';
import { findAnniversariesForYear } from '@/features/nenki/queries';

/** 発送候補 1 宛先に含まれる (故人 × 回忌) の明細 (A-2 突合キー)。 */
export type ShipmentCandidateItem = {
  /** 対象故人 (Person.id)。突合の第一キー。 */
  personId: string;
  /** 過去帳エントリ (DeathLedgerEntry.id)。personId が将来欠ける場合の保険。 */
  entryId: string;
  /** 回忌 (1/3/7/...)。 */
  kaiki: number;
  secularName: string;
  anniversaryName: string;
  /** 同一対象 × 同一回忌 × 同一年が過去に既送か。 */
  alreadySent: boolean;
};

/** 既送状態。none=未送 / partial=一部既送 / all=全て既送。 */
export type DuplicateState = 'none' | 'partial' | 'all';

/** 発送候補の 1 宛先 (世帯単位)。同世帯に複数年忌があれば 1 件にまとめる。 */
export type ShipmentRecipientCandidate = {
  householdId: string;
  householderName: string;
  postalCode: string | null;
  address: string | null;
  /** 差込概要 (例: "山田花子 三回忌、山田一郎 七回忌")。 */
  summary: string;
  /** 住所が未登録の宛先か (発送前確認で注意喚起する)。 */
  missingAddress: boolean;
  /** 故人 × 回忌の明細 (A-2 突合キー)。明細生成・重複判定に使う。 */
  items: ShipmentCandidateItem[];
  /** この宛先の既送状態 (含まれる明細の alreadySent 集計)。 */
  duplicateState: DuplicateState;
};

/** (personId, kaiki) を 1 つの突合キー文字列にする。 */
function matchKey(personId: string, kaiki: number): string {
  return `${personId}:${kaiki}`;
}

/**
 * 指定年に年忌を迎える世帯を、案内発送の宛先候補として抽出する。
 *
 * - 弔い上げ済み (E22) / 論理削除 / 離檀世帯は findAnniversariesForYear 側で既に除外済み。
 * - N+1 解消: 該当世帯の postalCode/address を 1 クエリ (findMany + in) でまとめて取得する。
 * - 同一世帯に複数の故人が該当する場合は 1 宛先にまとめ、summary に列挙する。
 * - A-2 重複案内防止: 各 (故人, 回忌) について、過去の発送明細 (ShipmentRecipientItem) に
 *   同一対象 × 同一回忌 × 同一年が既送かを 1 クエリで突合し、世帯単位で既送状態を立てる。
 *   過去 (本機能導入前) の発送には明細が無いため突合に寄与しない (今後の発送から積み上がる)。
 */
export async function listShipmentCandidatesForYear(
  year: number,
): Promise<ShipmentRecipientCandidate[]> {
  const matches = await findAnniversariesForYear(year);
  if (matches.length === 0) return [];

  const tenantId = await requireCurrentTenantId();
  const householdIds = Array.from(new Set(matches.map((m) => m.householdId)));
  const personIds = Array.from(new Set(matches.map((m) => m.personId)));
  const kaikiList = Array.from(new Set(matches.map((m) => m.anniversary.kaiki)));

  // N+1 解消: 住所と既送明細を並列で一括取得する。
  const [households, existingItems] = await withTenant(tenantId, async (tx) => {
    const [hh, items] = await Promise.all([
      tx.household.findMany({
        where: { id: { in: householdIds } },
        select: { id: true, postalCode: true, address: true },
      }),
      tx.shipmentRecipientItem.findMany({
        where: {
          targetYear: year,
          targetPersonId: { in: personIds },
          anniversaryKaiki: { in: kaikiList },
        },
        select: { targetPersonId: true, anniversaryKaiki: true },
      }),
    ]);
    return [hh, items] as const;
  });
  const addrById = new Map(households.map((h) => [h.id, h]));

  // 既送 (personId, kaiki) ペアの集合。
  const sentKeys = new Set<string>();
  for (const it of existingItems) {
    if (it.targetPersonId === null) continue;
    sentKeys.add(matchKey(it.targetPersonId, it.anniversaryKaiki));
  }

  const byHousehold = new Map<string, ShipmentRecipientCandidate>();
  for (const m of matches) {
    const itemLabel = `${m.secularName} ${m.anniversary.name}`;
    const alreadySent = sentKeys.has(matchKey(m.personId, m.anniversary.kaiki));
    const item: ShipmentCandidateItem = {
      personId: m.personId,
      entryId: m.entryId,
      kaiki: m.anniversary.kaiki,
      secularName: m.secularName,
      anniversaryName: m.anniversary.name,
      alreadySent,
    };

    const existing = byHousehold.get(m.householdId);
    if (existing) {
      existing.summary = `${existing.summary}、${itemLabel}`;
      existing.items.push(item);
      continue;
    }
    const addr = addrById.get(m.householdId);
    byHousehold.set(m.householdId, {
      householdId: m.householdId,
      householderName: m.householdName,
      postalCode: addr?.postalCode ?? null,
      address: addr?.address ?? null,
      summary: itemLabel,
      missingAddress: !addr?.address,
      items: [item],
      duplicateState: 'none',
    });
  }

  // 世帯単位の既送状態を確定する (全既送=all / 一部=partial / なし=none)。
  const candidates = Array.from(byHousehold.values());
  for (const c of candidates) {
    const sentCount = c.items.filter((it) => it.alreadySent).length;
    if (sentCount === 0) {
      c.duplicateState = 'none';
    } else if (sentCount === c.items.length) {
      c.duplicateState = 'all';
    } else {
      c.duplicateState = 'partial';
    }
  }

  return candidates;
}

export type ShipmentBatchSummary = {
  id: string;
  title: string;
  documentType: string;
  recipientCount: number;
  targetYear: number | null;
  serviceDate: Date | null;
  createdAt: Date;
  sentByName: string | null;
};

/**
 * 発送履歴の一覧 (誰に・いつ・何を)。新しい順。Phase 1 は 100 件上限。
 */
export async function listShipmentBatches(): Promise<ShipmentBatchSummary[]> {
  const tenantId = await requireCurrentTenantId();
  return withTenant(tenantId, async (tx) => {
    const batches = await tx.shipmentBatch.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const userIds = Array.from(
      new Set(
        batches
          .map((b) => b.sentById)
          .filter((id): id is string => id !== null),
      ),
    );
    const users =
      userIds.length > 0
        ? await tx.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, displayName: true },
          })
        : [];
    const nameById = new Map(users.map((u) => [u.id, u.displayName]));

    return batches.map((b) => ({
      id: b.id,
      title: b.title,
      documentType: b.documentType,
      recipientCount: b.recipientCount,
      targetYear: b.targetYear,
      serviceDate: b.serviceDate,
      createdAt: b.createdAt,
      sentByName: b.sentById ? (nameById.get(b.sentById) ?? null) : null,
    }));
  });
}

export type ShipmentBatchDetail = ShipmentBatchSummary & {
  location: string | null;
  offeringGuide: string | null;
  replyDeadline: Date | null;
  bodyNote: string | null;
  recipients: Array<{
    id: string;
    householdId: string | null;
    householderName: string;
    postalCode: string | null;
    address: string | null;
    summary: string | null;
  }>;
};

/** 発送履歴 1 件の詳細 (宛先一覧つき)。他テナントは RLS で null。 */
export async function getShipmentBatchById(
  id: string,
): Promise<ShipmentBatchDetail | null> {
  assertValidUuid(id, 'shipmentBatchId');
  const tenantId = await requireCurrentTenantId();
  return withTenant(tenantId, async (tx) => {
    const batch = await tx.shipmentBatch.findUnique({
      where: { id },
      include: {
        recipients: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!batch) return null;

    let sentByName: string | null = null;
    if (batch.sentById) {
      const user = await tx.user.findUnique({
        where: { id: batch.sentById },
        select: { displayName: true },
      });
      sentByName = user?.displayName ?? null;
    }

    return {
      id: batch.id,
      title: batch.title,
      documentType: batch.documentType,
      recipientCount: batch.recipientCount,
      targetYear: batch.targetYear,
      serviceDate: batch.serviceDate,
      createdAt: batch.createdAt,
      sentByName,
      location: batch.location,
      offeringGuide: batch.offeringGuide,
      replyDeadline: batch.replyDeadline,
      bodyNote: batch.bodyNote,
      recipients: batch.recipients.map((r) => ({
        id: r.id,
        householdId: r.householdId,
        householderName: r.householderName,
        postalCode: r.postalCode,
        address: r.address,
        summary: r.summary,
      })),
    };
  });
}
