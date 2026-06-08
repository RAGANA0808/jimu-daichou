/**
 * 発送 (案内本文 差込) フォームの入力検証 (純関数)。
 *
 * Server Action から切り離し、Vitest で網羅できるようにする。
 * 日時は JST 固定運用 (CLAUDE.md §4.3) のため、文字列を JST ローカルとして解釈する。
 */

import type { ShipmentDocumentType } from '@prisma/client';

export const SHIPMENT_DOCUMENT_TYPES: readonly ShipmentDocumentType[] = [
  'NOTICE_LETTER',
  'ADDRESS_LABEL',
  'ENVELOPE',
  'CSV',
];

export type ShipmentInput = {
  title: string;
  documentType: string;
  /** datetime-local 文字列 `YYYY-MM-DDTHH:mm` または空。 */
  serviceDate: string;
  location: string;
  offeringGuide: string;
  /** date 文字列 `YYYY-MM-DD` または空。 */
  replyDeadline: string;
  bodyNote: string;
};

export type ShipmentFieldName = keyof ShipmentInput;

export type ShipmentValidationResult = {
  errors: Partial<Record<ShipmentFieldName, string>>;
  values: {
    title: string;
    documentType: ShipmentDocumentType;
    serviceDate: Date | null;
    location: string | null;
    offeringGuide: string | null;
    replyDeadline: Date | null;
    bodyNote: string | null;
  };
};

function nullIfBlank(s: string): string | null {
  return s.length === 0 ? null : s;
}

/** `YYYY-MM-DDTHH:mm` を JST ローカル時刻として Date に変換する。不正なら null。 */
export function parseLocalDateTime(raw: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) return null;
  const [datePart, timePart] = raw.split('T');
  const [y, m, d] = datePart!.split('-').map((s) => Number.parseInt(s, 10));
  const [hh, mm] = timePart!.split(':').map((s) => Number.parseInt(s, 10));
  const date = new Date(y!, m! - 1, d!, hh!, mm!);
  if (
    date.getFullYear() !== y ||
    date.getMonth() + 1 !== m ||
    date.getDate() !== d ||
    date.getHours() !== hh ||
    date.getMinutes() !== mm
  ) {
    return null;
  }
  return date;
}

/** `YYYY-MM-DD` を JST の日付として Date に変換する。不正なら null。 */
export function parseLocalDate(raw: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [y, m, d] = raw.split('-').map((s) => Number.parseInt(s, 10));
  const date = new Date(y!, m! - 1, d!);
  if (
    date.getFullYear() !== y ||
    date.getMonth() + 1 !== m ||
    date.getDate() !== d
  ) {
    return null;
  }
  return date;
}

export function validateShipmentInput(
  input: ShipmentInput,
): ShipmentValidationResult {
  const errors: Partial<Record<ShipmentFieldName, string>> = {};

  const title = input.title.trim();
  if (title.length === 0) {
    errors.title = '発送名をご入力ください。';
  } else if (title.length > 120) {
    errors.title = '発送名は 120 文字以内でご入力ください。';
  }

  let documentType: ShipmentDocumentType = 'NOTICE_LETTER';
  if (!(SHIPMENT_DOCUMENT_TYPES as string[]).includes(input.documentType)) {
    errors.documentType = '発送物の種別が正しくありません。';
  } else {
    documentType = input.documentType as ShipmentDocumentType;
  }

  let serviceDate: Date | null = null;
  if (input.serviceDate.trim().length > 0) {
    serviceDate = parseLocalDateTime(input.serviceDate.trim());
    if (serviceDate === null) {
      errors.serviceDate = '法要日時の形式が正しくありません。';
    }
  }

  let replyDeadline: Date | null = null;
  if (input.replyDeadline.trim().length > 0) {
    replyDeadline = parseLocalDate(input.replyDeadline.trim());
    if (replyDeadline === null) {
      errors.replyDeadline = '返信締切の形式が正しくありません。';
    }
  }

  const location = input.location.trim();
  if (location.length > 200) {
    errors.location = '場所は 200 文字以内でご入力ください。';
  }
  const offeringGuide = input.offeringGuide.trim();
  if (offeringGuide.length > 200) {
    errors.offeringGuide = 'お布施の目安は 200 文字以内でご入力ください。';
  }
  const bodyNote = input.bodyNote.trim();
  if (bodyNote.length > 2000) {
    errors.bodyNote = '本文への追記は 2000 文字以内でご入力ください。';
  }

  return {
    errors,
    values: {
      title,
      documentType,
      serviceDate,
      location: nullIfBlank(location),
      offeringGuide: nullIfBlank(offeringGuide),
      replyDeadline,
      bodyNote: nullIfBlank(bodyNote),
    },
  };
}
