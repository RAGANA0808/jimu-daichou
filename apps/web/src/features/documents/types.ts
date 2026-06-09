import type { Document } from '@prisma/client';

// 紐付け先の種別。Document の optional FK 4種に対応。
export type DocumentTargetKind =
  | 'household'
  | 'gravePlot'
  | 'transaction'
  | 'deathLedgerEntry';

export type DocumentTarget = {
  kind: DocumentTargetKind;
  id: string; // 親エンティティの UUID
};

export type DocumentFieldName = 'title';

export type DocumentFormState = {
  status: 'idle' | 'error' | 'success';
  message?: string; // 成功/失敗の人間向け文言 (個人情報を含めない)
  errors?: Partial<Record<DocumentFieldName, string>>;
  values?: Partial<Record<DocumentFieldName, string>>;
};

export const initialDocumentFormState: DocumentFormState = { status: 'idle' };

// 一覧表示用 DTO (storagePath は UI に露出させない: signed URL は別アクションで都度発行)。
export type DocumentListItem = Pick<
  Document,
  'id' | 'title' | 'mimeType' | 'byteSize' | 'createdAt'
>;

// 紐付け種別の日本語ラベル (UI 表示・監査外の人間向け文言用)。
export const DOCUMENT_TARGET_LABELS: Record<DocumentTargetKind, string> = {
  household: '世帯',
  gravePlot: '区画',
  transaction: '会計',
  deathLedgerEntry: '過去帳',
};

// 許可 MIME (画像 / PDF / Office)。
export const ALLOWED_MIME_TYPES: ReadonlySet<string> = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024; // 20MB

export const DOCUMENT_TITLE_MAX_LENGTH = 120;
export const DOCUMENT_DELETED_REASON_MAX_LENGTH = 200;
