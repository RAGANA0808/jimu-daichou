'use server';

import type { InteractionCategory, InteractionKind } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { requireCapability } from '@/lib/auth';
import { assertValidUuid, withTenant } from '@/lib/db';
import { recordAudit } from '@/lib/audit/record';
import {
  INTERACTION_CATEGORY_ORDER,
  INTERACTION_KIND_ORDER,
  type InteractionFieldName,
  type InteractionFormState,
} from './interaction-types';

function readField(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === 'string' ? v.trim() : '';
}

type InteractionValues = Record<InteractionFieldName, string> & {
  isPinned: boolean;
};

function extractValues(formData: FormData): InteractionValues {
  return {
    kind: readField(formData, 'kind'),
    category: readField(formData, 'category'),
    content: readField(formData, 'content'),
    occurredAt: readField(formData, 'occurredAt'),
    isPinned: formData.get('isPinned') === 'on',
  };
}

/** エラー時の値復元用に boolean を文字列化した state.values を作る。 */
function toFormValues(
  values: InteractionValues,
): NonNullable<InteractionFormState['values']> {
  return {
    kind: values.kind,
    category: values.category,
    content: values.content,
    occurredAt: values.occurredAt,
    isPinned: values.isPinned ? 'true' : '',
  };
}

/**
 * datetime-local (`YYYY-MM-DDTHH:mm`) を JST のローカル時刻として解釈する。
 * Asia/Tokyo 固定運用 (CLAUDE.md §4.3) なので new Date(...) のローカル解釈をそのまま使う。
 */
function parseOccurredAt(raw: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) return null;
  const [datePart, timePart] = raw.split('T');
  if (!datePart || !timePart) return null;
  const [y, m, d] = datePart.split('-').map((s) => Number.parseInt(s, 10));
  const [hh, mm] = timePart.split(':').map((s) => Number.parseInt(s, 10));
  if (
    typeof y !== 'number' ||
    typeof m !== 'number' ||
    typeof d !== 'number' ||
    typeof hh !== 'number' ||
    typeof mm !== 'number' ||
    Number.isNaN(y) ||
    Number.isNaN(m) ||
    Number.isNaN(d) ||
    Number.isNaN(hh) ||
    Number.isNaN(mm)
  ) {
    return null;
  }
  const date = new Date(y, m - 1, d, hh, mm);
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

function validate(values: InteractionValues): {
  errors: NonNullable<InteractionFormState['errors']>;
  kind: InteractionKind;
  category: InteractionCategory;
  content: string;
  occurredAt: Date | null;
  isPinned: boolean;
} {
  const errors: NonNullable<InteractionFormState['errors']> = {};

  let kind: InteractionKind = 'NOTE';
  if (values.kind.length === 0) {
    errors.kind = '種別をご選択ください。';
  } else if (!(INTERACTION_KIND_ORDER as string[]).includes(values.kind)) {
    errors.kind = '種別が正しくありません。';
  } else {
    kind = values.kind as InteractionKind;
  }

  let category: InteractionCategory = 'OTHER';
  if (values.category.length === 0) {
    category = 'OTHER';
  } else if (
    !(INTERACTION_CATEGORY_ORDER as string[]).includes(values.category)
  ) {
    errors.category = '話題が正しくありません。';
  } else {
    category = values.category as InteractionCategory;
  }

  let content = '';
  if (values.content.length === 0) {
    errors.content = '内容をご入力ください。';
  } else if (values.content.length > 4000) {
    errors.content = '4000 文字以内でご入力ください。';
  } else {
    content = values.content;
  }

  let occurredAt: Date | null = null;
  if (values.occurredAt.length === 0) {
    errors.occurredAt = '日時をご入力ください。';
  } else {
    const d = parseOccurredAt(values.occurredAt);
    if (d === null) {
      errors.occurredAt = '日時の形式が正しくありません。';
    } else {
      occurredAt = d;
    }
  }

  return { errors, kind, category, content, occurredAt, isPinned: values.isPinned };
}

/**
 * 対応履歴の新規登録。記録者は現在ログイン中のユーザーを自動設定する。
 */
export async function createInteractionNoteAction(
  _prev: InteractionFormState,
  formData: FormData,
): Promise<InteractionFormState> {
  const householdId = readField(formData, 'householdId');
  assertValidUuid(householdId, 'householdId');

  const values = extractValues(formData);
  const v = validate(values);
  if (Object.keys(v.errors).length > 0 || v.occurredAt === null) {
    return { status: 'error', errors: v.errors, values: toFormValues(values) };
  }

  const user = await requireCapability('create');
  const tenantId = user.tenantId;

  const household = await withTenant(tenantId, (tx) =>
    tx.household.findUnique({
      where: { id: householdId },
      select: { id: true },
    }),
  );
  if (!household) {
    return {
      status: 'error',
      errors: { content: '対象の世帯が見つかりませんでした。' },
      values: toFormValues(values),
    };
  }

  await withTenant(tenantId, async (tx) => {
    const created = await tx.interactionNote.create({
      data: {
        tenantId,
        householdId,
        authorId: user.id,
        kind: v.kind,
        category: v.category,
        isPinned: v.isPinned,
        content: v.content,
        occurredAt: v.occurredAt!,
      },
      select: { id: true },
    });
    // 監査: 本文 (content) は PII のため載せない。種別・話題 (enum) のみ。
    await recordAudit(tx, tenantId, {
      actorId: user.id,
      action: 'CREATE',
      entityType: 'InteractionNote',
      entityId: created.id,
      summary: `対応履歴を登録 (種別=${v.kind}, 話題=${v.category})`,
    });
  });

  revalidatePath(`/danshintoto/${householdId}`);
  return { status: 'success' };
}

/**
 * 対応履歴の編集。記録者 (authorId) は変更しない。
 */
export async function updateInteractionNoteAction(
  _prev: InteractionFormState,
  formData: FormData,
): Promise<InteractionFormState> {
  const id = readField(formData, 'interactionNoteId');
  assertValidUuid(id, 'interactionNoteId');
  const householdId = readField(formData, 'householdId');
  assertValidUuid(householdId, 'householdId');

  const values = extractValues(formData);
  const v = validate(values);
  if (Object.keys(v.errors).length > 0 || v.occurredAt === null) {
    return { status: 'error', errors: v.errors, values: toFormValues(values) };
  }

  const user = await requireCapability('update');
  const tenantId = user.tenantId;

  await withTenant(tenantId, async (tx) => {
    const existing = await tx.interactionNote.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!existing) {
      throw new Error('対象の対応履歴が見つかりませんでした。');
    }
    await tx.interactionNote.update({
      where: { id },
      data: {
        kind: v.kind,
        category: v.category,
        isPinned: v.isPinned,
        content: v.content,
        occurredAt: v.occurredAt!,
      },
    });
    await recordAudit(tx, tenantId, {
      actorId: user.id,
      action: 'UPDATE',
      entityType: 'InteractionNote',
      entityId: id,
      summary: `対応履歴を編集 (種別=${v.kind}, 話題=${v.category})`,
    });
  });

  revalidatePath(`/danshintoto/${householdId}`);
  return { status: 'success' };
}

/**
 * 対応履歴の「除外」(論理削除)。deletedAt を立てるのみで物理削除はしない。
 */
export async function softDeleteInteractionNoteAction(
  formData: FormData,
): Promise<void> {
  const id = readField(formData, 'interactionNoteId');
  assertValidUuid(id, 'interactionNoteId');
  const householdId = readField(formData, 'householdId');
  assertValidUuid(householdId, 'householdId');

  const user = await requireCapability('softDelete');
  const tenantId = user.tenantId;
  await withTenant(tenantId, async (tx) => {
    const existing = await tx.interactionNote.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!existing) {
      throw new Error('対象の対応履歴が見つかりませんでした。');
    }
    await tx.interactionNote.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await recordAudit(tx, tenantId, {
      actorId: user.id,
      action: 'DELETE',
      entityType: 'InteractionNote',
      entityId: id,
      summary: '対応履歴を除外 (論理削除)',
    });
  });

  revalidatePath(`/danshintoto/${householdId}`);
}

// ピン留めトグル (toggleInteractionNotePin) は表示上の固定の切替であり
// 内容変更を伴わない軽微操作のため監査対象外とする (監査ログのノイズ回避)。

/**
 * 対応履歴のピン留め (固定) のトグル。フォーム値検証を伴わない軽量更新。
 * isPinned には目標値 ('true' | 'false') を渡す。
 */
export async function toggleInteractionNotePinAction(
  formData: FormData,
): Promise<void> {
  const id = readField(formData, 'interactionNoteId');
  assertValidUuid(id, 'interactionNoteId');
  const householdId = readField(formData, 'householdId');
  assertValidUuid(householdId, 'householdId');
  const target = formData.get('isPinned') === 'true';

  const tenantId = (await requireCapability('update')).tenantId;
  await withTenant(tenantId, async (tx) => {
    const existing = await tx.interactionNote.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!existing) {
      throw new Error('対象の対応履歴が見つかりませんでした。');
    }
    await tx.interactionNote.update({
      where: { id },
      data: { isPinned: target },
    });
  });

  revalidatePath(`/danshintoto/${householdId}`);
}
