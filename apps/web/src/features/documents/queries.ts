import 'server-only';
import { requireCapability } from '@/lib/auth';
import { assertValidUuid, withTenant } from '@/lib/db';
import type { DocumentListItem } from './types';

// storagePath は UI へ露出させない (signed URL は getDocumentDownloadUrlAction で都度発行)。
const LIST_SELECT = {
  id: true,
  title: true,
  mimeType: true,
  byteSize: true,
  createdAt: true,
} as const;

/**
 * 世帯に紐づく書類一覧 (除外済みを除く・新しい順)。
 * RLS + deletedAt:null + householdId 一致でテナント境界と論理削除を二重に担保する。
 */
export async function listDocumentsByHousehold(
  householdId: string,
): Promise<DocumentListItem[]> {
  assertValidUuid(householdId, 'householdId');
  const tenantId = (await requireCapability('read')).tenantId;
  return withTenant(tenantId, (tx) =>
    tx.document.findMany({
      where: { householdId, deletedAt: null },
      select: LIST_SELECT,
      orderBy: { createdAt: 'desc' },
    }),
  );
}

/**
 * 区画に紐づく書類一覧 (除外済みを除く・新しい順)。
 */
export async function listDocumentsByGravePlot(
  gravePlotId: string,
): Promise<DocumentListItem[]> {
  assertValidUuid(gravePlotId, 'gravePlotId');
  const tenantId = (await requireCapability('read')).tenantId;
  return withTenant(tenantId, (tx) =>
    tx.document.findMany({
      where: { gravePlotId, deletedAt: null },
      select: LIST_SELECT,
      orderBy: { createdAt: 'desc' },
    }),
  );
}

/**
 * 会計 (Transaction) に紐づく書類一覧 (除外済みを除く・新しい順)。
 */
export async function listDocumentsByTransaction(
  transactionId: string,
): Promise<DocumentListItem[]> {
  assertValidUuid(transactionId, 'transactionId');
  const tenantId = (await requireCapability('read')).tenantId;
  return withTenant(tenantId, (tx) =>
    tx.document.findMany({
      where: { transactionId, deletedAt: null },
      select: LIST_SELECT,
      orderBy: { createdAt: 'desc' },
    }),
  );
}

/**
 * 過去帳エントリに紐づく書類一覧 (除外済みを除く・新しい順)。
 */
export async function listDocumentsByDeathLedgerEntry(
  deathLedgerEntryId: string,
): Promise<DocumentListItem[]> {
  assertValidUuid(deathLedgerEntryId, 'deathLedgerEntryId');
  const tenantId = (await requireCapability('read')).tenantId;
  return withTenant(tenantId, (tx) =>
    tx.document.findMany({
      where: { deathLedgerEntryId, deletedAt: null },
      select: LIST_SELECT,
      orderBy: { createdAt: 'desc' },
    }),
  );
}
