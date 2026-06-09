'use server';

import type { Prisma, SuccessionReason } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { requireCapability } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { assertValidUuid, withTenant } from '@/lib/db';
import {
  SUCCESSION_REASON_ORDER,
  type SuccessionFieldName,
  type SuccessionFormState,
} from './succession-types';

function readField(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === 'string' ? v.trim() : '';
}

function nullIfBlank(value: string): string | null {
  return value.length === 0 ? null : value;
}

/**
 * `YYYY-MM-DD` を @db.Date 用の UTC 0 時 Date に変換する (規約: Date.UTC で扱う)。
 * 不正・空は null。実在しない日付も null にする。
 */
function parseDateOnly(raw: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [y, m, d] = raw.split('-').map((s) => Number.parseInt(s, 10));
  if (
    typeof y !== 'number' ||
    typeof m !== 'number' ||
    typeof d !== 'number' ||
    Number.isNaN(y) ||
    Number.isNaN(m) ||
    Number.isNaN(d)
  ) {
    return null;
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() + 1 !== m ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  return date;
}

type SuccessionValues = Record<SuccessionFieldName, string>;

function extractValues(formData: FormData): SuccessionValues {
  return {
    reason: readField(formData, 'reason'),
    previousHouseholderName: readField(formData, 'previousHouseholderName'),
    nextHouseholderName: readField(formData, 'nextHouseholderName'),
    occurredAt: readField(formData, 'occurredAt'),
    note: readField(formData, 'note'),
  };
}

/**
 * 承継候補/記録の手動起票。status=PROPOSED で create するに留め、Household.householderName は
 * 一切書き換えない (TERA 特許回避の核: 候補は提示まで)。確定は approve でのみ行う。
 */
export async function proposeSuccessionAction(
  _prev: SuccessionFormState,
  formData: FormData,
): Promise<SuccessionFormState> {
  const householdId = readField(formData, 'householdId');
  assertValidUuid(householdId, 'householdId');

  const values = extractValues(formData);
  const errors: NonNullable<SuccessionFormState['errors']> = {};

  let reason: SuccessionReason = 'OTHER';
  if (values.reason.length === 0) {
    reason = 'DEATH';
  } else if (!(SUCCESSION_REASON_ORDER as string[]).includes(values.reason)) {
    errors.reason = '事由が正しくありません。';
  } else {
    reason = values.reason as SuccessionReason;
  }

  if (values.previousHouseholderName.length > 60) {
    errors.previousHouseholderName = '60 文字以内でご入力ください。';
  }
  if (values.nextHouseholderName.length > 60) {
    errors.nextHouseholderName = '60 文字以内でご入力ください。';
  }
  if (values.note.length > 500) {
    errors.note = '500 文字以内でご入力ください。';
  }

  let occurredAt: Date | null = null;
  if (values.occurredAt.length > 0) {
    occurredAt = parseDateOnly(values.occurredAt);
    if (occurredAt === null) {
      errors.occurredAt = '発生日の形式が正しくありません。';
    }
  }

  if (Object.keys(errors).length > 0) {
    return { status: 'error', errors, values };
  }

  const user = await requireCapability('create');
  const tenantId = user.tenantId;
  await withTenant(tenantId, async (tx) => {
    const household = await tx.household.findUnique({
      where: { id: householdId },
      select: { id: true },
    });
    if (!household) {
      throw new Error('対象の世帯が見つかりませんでした。');
    }
    const created = await tx.householdSuccession.create({
      data: {
        tenantId,
        householdId,
        reason,
        previousHouseholderName: nullIfBlank(values.previousHouseholderName),
        nextHouseholderName: nullIfBlank(values.nextHouseholderName),
        occurredAt,
        note: nullIfBlank(values.note),
        status: 'PROPOSED',
      },
      select: { id: true },
    });
    await recordAudit(tx, tenantId, {
      actorId: user.id,
      action: 'CREATE',
      entityType: 'HouseholdSuccession',
      entityId: created.id,
      summary: `承継候補を起票 (reason=${reason})`,
    });
  });

  revalidatePath(`/danshintoto/${householdId}`);
  return { status: 'success' };
}

/**
 * 承継候補の手動承認。担当者の明示操作でのみ施主表示を更新しうる (特許回避の核)。
 * applyToHousehold='true' のときに限り、同一トランザクション内で
 * Household.householderName / nameKana を確定値で更新する。
 *
 * 権限: 承認は破壊的操作 (施主表示の確定) のため destructive。READ_ONLY/STAFF を弾く。
 */
export async function approveSuccessionAction(
  formData: FormData,
): Promise<void> {
  const householdId = readField(formData, 'householdId');
  assertValidUuid(householdId, 'householdId');
  const successionId = readField(formData, 'successionId');
  assertValidUuid(successionId, 'successionId');

  const applyToHousehold = formData.get('applyToHousehold') === 'true';
  const nextHouseholderName = readField(formData, 'nextHouseholderName');
  const nextNameKana = readField(formData, 'nextNameKana');

  const user = await requireCapability('destructive');
  const tenantId = user.tenantId;

  await withTenant(tenantId, async (tx) => {
    const succession = await tx.householdSuccession.findFirst({
      where: { id: successionId, householdId },
      select: { id: true, status: true },
    });
    if (!succession) {
      throw new Error('対象の承継候補が見つかりませんでした。');
    }
    if (succession.status !== 'PROPOSED') return; // 冪等: 承認/却下済みはスキップ

    await tx.householdSuccession.update({
      where: { id: successionId },
      data: {
        status: 'APPROVED',
        approvedById: user.id,
        approvedAt: new Date(),
        nextHouseholderName: nullIfBlank(nextHouseholderName),
      },
    });

    // 施主表示の更新は「承認後のみ・明示指定時のみ」(自動経路を作らない)。
    if (applyToHousehold && nextHouseholderName.length > 0) {
      await tx.household.update({
        where: { id: householdId },
        data: {
          householderName: nextHouseholderName,
          // 検索用かながずれないよう、入力があれば同時更新する。
          ...(nextNameKana.length > 0 ? { nameKana: nextNameKana } : {}),
        },
      });
    }

    // 実際に状態遷移したときのみ記録する (冪等スキップ時は上で return 済み)。
    await recordAudit(tx, tenantId, {
      actorId: user.id,
      action: 'APPROVE',
      entityType: 'HouseholdSuccession',
      entityId: successionId,
      summary: `承継候補を承認 (applyToHousehold=${applyToHousehold})`,
    });
  });

  revalidatePath(`/danshintoto/${householdId}`);
  revalidatePath('/danshintoto');
}

/**
 * 承継候補の却下 (誤起票の論理無効化)。物理削除しない。冪等。
 *
 * 権限: 却下も施主表示確定に関わる判断のため destructive。READ_ONLY/STAFF を弾く。
 */
export async function rejectSuccessionAction(
  formData: FormData,
): Promise<void> {
  const householdId = readField(formData, 'householdId');
  assertValidUuid(householdId, 'householdId');
  const successionId = readField(formData, 'successionId');
  assertValidUuid(successionId, 'successionId');
  const note = readField(formData, 'note');

  const user = await requireCapability('destructive');
  const tenantId = user.tenantId;

  await withTenant(tenantId, async (tx) => {
    const succession = await tx.householdSuccession.findFirst({
      where: { id: successionId, householdId },
      select: { id: true, status: true, note: true },
    });
    if (!succession) {
      throw new Error('対象の承継候補が見つかりませんでした。');
    }
    if (succession.status !== 'PROPOSED') return; // 冪等

    await tx.householdSuccession.update({
      where: { id: successionId },
      data: {
        status: 'REJECTED',
        rejectedById: user.id,
        rejectedAt: new Date(),
        note: nullIfBlank(note) ?? succession.note,
      },
    });

    await recordAudit(tx, tenantId, {
      actorId: user.id,
      action: 'OTHER',
      entityType: 'HouseholdSuccession',
      entityId: successionId,
      summary: '承継候補を却下',
    });
  });

  revalidatePath(`/danshintoto/${householdId}`);
}

/**
 * 死亡登録を契機とした承継候補の起票 (内部ヘルパ。Server Action ではなく tx を受ける純内部関数)。
 *
 * createDeathLedgerEntryAction のトランザクション末尾から呼ぶ。
 * 故人が世帯の施主 (householderName と俗名が一致) と推定される場合のみ PROPOSED を起票する。
 * 【特許回避】次施主は一切設定せず (next* は空)、Household.householderName も書き換えない。
 * 誤検知しても PROPOSED 止まりで人間が却下できるため、施主一致は緩めに拾う。
 * 冪等: 同一 (householdId, previousPersonId, status=PROPOSED) が既にあれば二重起票しない。
 */
export async function maybeProposeSuccessionOnDeath(
  tx: Prisma.TransactionClient,
  args: {
    tenantId: string;
    householdId: string;
    deceasedPersonId: string;
    deceasedSecularName: string;
    occurredAt: Date | null;
  },
): Promise<void> {
  const household = await tx.household.findUnique({
    where: { id: args.householdId },
    select: { householderName: true },
  });
  if (!household) return;

  // 施主一致のヒューリスティック: 俗名が施主名を含む / 施主名が俗名を含む (姓のみ登録等を緩く拾う)。
  const householder = household.householderName.replace(/[\s　]/g, '');
  const deceased = args.deceasedSecularName.replace(/[\s　]/g, '');
  if (householder.length === 0 || deceased.length === 0) return;
  const looksLikeHouseholder =
    householder === deceased ||
    householder.includes(deceased) ||
    deceased.includes(householder);
  if (!looksLikeHouseholder) return;

  // 冪等: 同一故人の未承認候補が既にあれば起票しない。
  const existing = await tx.householdSuccession.findFirst({
    where: {
      householdId: args.householdId,
      previousPersonId: args.deceasedPersonId,
      status: 'PROPOSED',
    },
    select: { id: true },
  });
  if (existing) return;

  await tx.householdSuccession.create({
    data: {
      tenantId: args.tenantId,
      householdId: args.householdId,
      reason: 'DEATH',
      previousHouseholderName: args.deceasedSecularName,
      previousPersonId: args.deceasedPersonId,
      // 次施主は設定しない (全自動禁止)。
      occurredAt: args.occurredAt,
      status: 'PROPOSED',
    },
    select: { id: true },
  });
}
