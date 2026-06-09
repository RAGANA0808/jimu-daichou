'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { requireCapability } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { isValidUuid, withTenant } from '@/lib/db';
import {
  createDocumentSignedUrl,
  removeDocumentObject,
  uploadDocumentObject,
} from '@/lib/storage';
import {
  ALLOWED_MIME_TYPES,
  DOCUMENT_DELETED_REASON_MAX_LENGTH,
  DOCUMENT_TITLE_MAX_LENGTH,
  MAX_DOCUMENT_BYTES,
  type DocumentFormState,
  type DocumentTargetKind,
} from './types';

const TARGET_KINDS: readonly DocumentTargetKind[] = [
  'household',
  'gravePlot',
  'transaction',
  'deathLedgerEntry',
];

// 紐付け種別 → Document の FK 列名。
const FK_COLUMN: Record<DocumentTargetKind, string> = {
  household: 'householdId',
  gravePlot: 'gravePlotId',
  transaction: 'transactionId',
  deathLedgerEntry: 'deathLedgerEntryId',
};

function readField(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === 'string' ? v.trim() : '';
}

function isTargetKind(value: string): value is DocumentTargetKind {
  return (TARGET_KINDS as readonly string[]).includes(value);
}

/**
 * Storage オブジェクト名に使うファイル名を安全化する。
 * パスインジェクション/日本語ファイル名対策 (表示名は title を使うので blob 名は安全化してよい)。
 */
function sanitizeFilename(name: string): string {
  const base = name.replace(/[^\w.\-]/g, '_');
  const trimmed = base.length > 0 ? base : 'file';
  return trimmed.slice(0, 100);
}

/**
 * 拡張子から download 時の表示ファイル名を組み立てる (title ベース)。
 * mimeType と元ファイル名は保持していないため、title に既存拡張子が無ければそのまま使う。
 */
const MIME_EXTENSION: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
};

function deriveDownloadName(title: string, mimeType: string): string {
  const safeTitle = sanitizeFilename(title);
  const ext = MIME_EXTENSION[mimeType] ?? '';
  if (ext && !safeTitle.toLowerCase().endsWith(ext)) {
    return `${safeTitle}${ext}`;
  }
  return safeTitle;
}

/**
 * 親種別に応じて revalidate するパスを返す。
 * deathLedgerEntry は世帯配下のネストルートなので、親世帯 id が必要。
 */
function revalidateForTarget(
  kind: DocumentTargetKind,
  targetId: string,
  householdIdForEntry: string | null,
): void {
  switch (kind) {
    case 'household':
      revalidatePath(`/danshintoto/${targetId}`);
      return;
    case 'gravePlot':
      revalidatePath(`/kukaku/${targetId}`);
      return;
    case 'transaction':
      revalidatePath(`/kaikei/${targetId}`);
      return;
    case 'deathLedgerEntry':
      if (householdIdForEntry) {
        revalidatePath(
          `/danshintoto/${householdIdForEntry}/kakochou/${targetId}`,
        );
        revalidatePath(`/danshintoto/${householdIdForEntry}`);
      }
      return;
  }
}

const UPLOAD_FAILURE_MESSAGE =
  '書類の保存に問題が発生しました。お手数ですが時間をおいて再度お試しください。';

/**
 * 書類のアップロード (D-1)。
 *
 * 処理順 (厳守):
 * 1. 検証 (DB 前) — title / targetKind / targetId / file。
 * 2. requireCapability('create')。
 * 3. documentId 先採番 → storagePath 組立 → Storage へ先行アップロード。
 * 4. withTenant 内で親エンティティ所有検証 → Document 作成 → recordAudit。
 * 5. withTenant 失敗時は blob を cleanup (best-effort)。
 */
export async function uploadDocumentAction(
  _prev: DocumentFormState,
  formData: FormData,
): Promise<DocumentFormState> {
  const title = readField(formData, 'title');
  const targetKindRaw = readField(formData, 'targetKind');
  const targetId = readField(formData, 'targetId');
  const file = formData.get('file');

  const errors: NonNullable<DocumentFormState['errors']> = {};
  if (title.length === 0) {
    errors.title = '書類名をご入力ください。';
  } else if (title.length > DOCUMENT_TITLE_MAX_LENGTH) {
    errors.title = `${DOCUMENT_TITLE_MAX_LENGTH} 文字以内でご入力ください。`;
  }

  if (Object.keys(errors).length > 0) {
    return { status: 'error', errors, values: { title } };
  }

  if (!isTargetKind(targetKindRaw)) {
    return {
      status: 'error',
      message: '紐付け先の種別が正しくありません。',
      values: { title },
    };
  }
  const targetKind = targetKindRaw;

  if (!isValidUuid(targetId)) {
    return {
      status: 'error',
      message: '紐付け先が正しくありません。',
      values: { title },
    };
  }

  if (!(file instanceof File) || file.size === 0) {
    return {
      status: 'error',
      message: 'ファイルを選択してください。',
      values: { title },
    };
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    return {
      status: 'error',
      message: 'ファイルサイズが大きすぎます (上限 20MB)。',
      values: { title },
    };
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return {
      status: 'error',
      message: '対応していないファイル形式です。',
      values: { title },
    };
  }

  const user = await requireCapability('create');
  const tenantId = user.tenantId;

  // documentId を先に採番して storage パスへ含める (衝突回避・cleanup 対象の特定)。
  const documentId = randomUUID();
  const storagePath = `${tenantId}/${documentId}/${sanitizeFilename(file.name)}`;
  const mimeType = file.type;
  const byteSize = file.size;

  // Storage へ先行アップロード (DB は後追い。DB 失敗時に blob を cleanup できるようにする)。
  try {
    const body = await file.arrayBuffer();
    await uploadDocumentObject({ storagePath, body, contentType: mimeType });
  } catch {
    return { status: 'error', message: UPLOAD_FAILURE_MESSAGE };
  }

  try {
    const householdIdForEntry = await withTenant(tenantId, async (tx) => {
      let entryHouseholdId: string | null = null;

      // 親エンティティ所有検証 (RLS 越し)。見つからなければ throw → catch で blob cleanup。
      switch (targetKind) {
        case 'household': {
          const found = await tx.household.findUnique({
            where: { id: targetId },
            select: { id: true },
          });
          if (!found) throw new Error('対象の世帯が見つかりませんでした。');
          break;
        }
        case 'gravePlot': {
          const found = await tx.gravePlot.findUnique({
            where: { id: targetId },
            select: { id: true },
          });
          if (!found) throw new Error('対象の区画が見つかりませんでした。');
          break;
        }
        case 'transaction': {
          const found = await tx.transaction.findUnique({
            where: { id: targetId },
            select: { id: true },
          });
          if (!found) throw new Error('対象の会計が見つかりませんでした。');
          break;
        }
        case 'deathLedgerEntry': {
          const found = await tx.deathLedgerEntry.findUnique({
            where: { id: targetId },
            select: { person: { select: { householdId: true } } },
          });
          if (!found) {
            throw new Error('対象の過去帳エントリが見つかりませんでした。');
          }
          entryHouseholdId = found.person.householdId;
          break;
        }
      }

      await tx.document.create({
        data: {
          id: documentId,
          tenantId,
          title,
          storagePath,
          mimeType,
          byteSize,
          uploadedById: user.id,
          [FK_COLUMN[targetKind]]: targetId,
        },
        select: { id: true },
      });

      await recordAudit(tx, tenantId, {
        actorId: user.id,
        action: 'CREATE',
        entityType: 'Document',
        entityId: documentId,
        summary: `書類を追加 (種別=${targetKind})`,
      });

      return entryHouseholdId;
    });

    revalidateForTarget(targetKind, targetId, householdIdForEntry);
    return { status: 'success', message: '書類を追加しました。' };
  } catch {
    // DB 作成に失敗したら孤児 blob を残さないよう cleanup (best-effort)。
    await removeDocumentObject(storagePath);
    return { status: 'error', message: UPLOAD_FAILURE_MESSAGE };
  }
}

/**
 * 書類の除外 (論理削除)。blob は保持する (物理削除しない)。
 */
export async function softDeleteDocumentAction(
  _prev: DocumentFormState,
  formData: FormData,
): Promise<DocumentFormState> {
  const documentId = readField(formData, 'documentId');
  if (!isValidUuid(documentId)) {
    return { status: 'error', message: '対象が正しくありません。' };
  }
  const deletedReasonRaw = readField(formData, 'deletedReason');
  if (deletedReasonRaw.length > DOCUMENT_DELETED_REASON_MAX_LENGTH) {
    return {
      status: 'error',
      message: `除外理由は ${DOCUMENT_DELETED_REASON_MAX_LENGTH} 文字以内でご入力ください。`,
    };
  }
  const deletedReason = deletedReasonRaw.length > 0 ? deletedReasonRaw : null;

  const user = await requireCapability('softDelete');
  const tenantId = user.tenantId;

  try {
    const result = await withTenant(tenantId, async (tx) => {
      const existing = await tx.document.findUnique({
        where: { id: documentId },
        select: {
          id: true,
          deletedAt: true,
          householdId: true,
          gravePlotId: true,
          transactionId: true,
          deathLedgerEntryId: true,
        },
      });
      if (!existing) {
        throw new Error('対象の書類が見つかりませんでした。');
      }
      if (existing.deletedAt !== null) {
        // 既に除外済み: 冪等成功扱い (再除外しない)。
        return { skipped: true, target: existing };
      }

      await tx.document.update({
        where: { id: documentId },
        data: {
          deletedAt: new Date(),
          deletedBy: user.id,
          deletedReason,
        },
      });

      await recordAudit(tx, tenantId, {
        actorId: user.id,
        action: 'DELETE',
        entityType: 'Document',
        entityId: documentId,
        summary: '書類を除外 (論理削除)',
      });

      return { skipped: false, target: existing };
    });

    // 紐付け先の一覧ページを更新する。
    const t = result.target;
    if (t.householdId) revalidatePath(`/danshintoto/${t.householdId}`);
    if (t.gravePlotId) revalidatePath(`/kukaku/${t.gravePlotId}`);
    if (t.transactionId) revalidatePath(`/kaikei/${t.transactionId}`);
    if (t.deathLedgerEntryId) {
      // 過去帳エントリは世帯配下ルート。親世帯 id を引いてから revalidate する。
      const householdId = await withTenant(tenantId, (tx) =>
        tx.deathLedgerEntry
          .findUnique({
            where: { id: t.deathLedgerEntryId as string },
            select: { person: { select: { householdId: true } } },
          })
          .then((e) => e?.person.householdId ?? null),
      );
      if (householdId) {
        revalidatePath(
          `/danshintoto/${householdId}/kakochou/${t.deathLedgerEntryId}`,
        );
        revalidatePath(`/danshintoto/${householdId}`);
      }
    }

    return { status: 'success', message: '書類を除外しました。' };
  } catch {
    return {
      status: 'error',
      message:
        '除外中に問題が発生しました。お手数ですが時間をおいて再度お試しください。',
    };
  }
}

export type DocumentDownloadResult =
  | { status: 'ok'; url: string }
  | { status: 'error'; message: string };

/**
 * プレビュー/ダウンロード用の短命 signed URL を都度発行する (URL を永続化しない)。
 * 閲覧は高頻度・非破壊のため監査は記録しない。
 */
export async function getDocumentDownloadUrlAction(
  documentId: string,
  mode: 'preview' | 'download',
): Promise<DocumentDownloadResult> {
  if (!isValidUuid(documentId)) {
    return { status: 'error', message: '対象が正しくありません。' };
  }

  try {
    const user = await requireCapability('read');
    const tenantId = user.tenantId;

    // withTenant でテナント所有 + 除外済みでないことを検証してから署名する。
    const doc = await withTenant(tenantId, (tx) =>
      tx.document.findFirst({
        where: { id: documentId, deletedAt: null },
        select: { storagePath: true, title: true, mimeType: true },
      }),
    );
    if (!doc) {
      return { status: 'error', message: '対象の書類が見つかりませんでした。' };
    }

    // storage は DB Tx の外で発行する (DB ロックを長く保持しない)。
    const url = await createDocumentSignedUrl(
      doc.storagePath,
      mode === 'download'
        ? { downloadName: deriveDownloadName(doc.title, doc.mimeType) }
        : undefined,
    );
    return { status: 'ok', url };
  } catch {
    return {
      status: 'error',
      message: 'ダウンロード用リンクの発行に失敗しました。',
    };
  }
}
