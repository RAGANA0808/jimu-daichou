'use server';

import { revalidatePath } from 'next/cache';
import { requireCapability } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { assertValidUuid, withTenant } from '@/lib/db';
import { parseIsoDate } from '@/lib/grave/date';

/**
 * 合祀期限まわりの破壊的操作 (G-8: 改葬 / 墓じまい / 合祀移行)。
 *
 * 【厳守】いずれも requireCapability('destructive') + recordAudit + 単一 withTenant トランザクション内で
 * 状態遷移する。理由 (reason) と確認チェックを必須化し、確認ダイアログ経由でのみ確定する。
 *
 * 【特許回避 = 自動遷移なし】これらは全て人の submit が起点。cron / トリガ / updateMany による
 * 一括自動遷移は作らない。合祀候補が「到来」しても自動では INTERRED_TOGETHER にしない。
 *
 * 【状態の二軸 (取り違え厳禁)】
 *   - 墓じまい = GraveContract.status TERMINATED + GravePlot.status CLOSED (解約意思)
 *   - 合祀移行 = GraveContract.status EXPIRED  + GravePlot.status INTERRED_TOGETHER (満了到来)
 * 契約 status と区画 status は必ずペアで遷移させ、片方だけ更新しない。
 */

function readField(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === 'string' ? v.trim() : '';
}

/** memo 末尾に操作理由を追記する (既存値は残す)。deletedReason は論理削除専用なので使わない。 */
function appendReason(existing: string | null, label: string, reason: string): string {
  const note = `【${label}】${reason}`;
  if (existing && existing.length > 0) {
    return `${existing}\n${note}`;
  }
  return note;
}

function requireReason(formData: FormData): string {
  const reason = readField(formData, 'reason');
  if (reason.length === 0) {
    throw new Error('操作の理由をご入力ください。');
  }
  if (reason.length > 500) {
    throw new Error('理由は 500 文字以内でご入力ください。');
  }
  // 確認チェックの担保 (UI 側でも必須。サーバ側でも二重に確認)。
  if (readField(formData, 'confirm') !== 'on') {
    throw new Error('確認のチェックを入れてください。');
  }
  return reason;
}

/**
 * 改葬 (G-8): 個々の遺骨を区画から出す (Burial.removedAt をセット)。
 * 区画・契約の状態は変えない (複数遺骨のうち 1 体だけのこともある)。論理削除しない (履歴として残す)。
 */
export async function recordReintermentAction(formData: FormData): Promise<void> {
  const burialId = readField(formData, 'burialId');
  const gravePlotId = readField(formData, 'gravePlotId');
  assertValidUuid(burialId, 'burialId');
  assertValidUuid(gravePlotId, 'gravePlotId');

  const reason = requireReason(formData);
  const removedAtRaw = readField(formData, 'removedAt');
  const removedAt = removedAtRaw.length > 0 ? parseIsoDate(removedAtRaw) : new Date();
  if (removedAt === null) {
    throw new Error('改葬日の形式が正しくありません。');
  }

  const user = await requireCapability('destructive');
  const tenantId = user.tenantId;
  const householdId = await withTenant(tenantId, async (tx) => {
    const burial = await tx.burial.findUnique({
      where: { id: burialId },
      select: {
        removedAt: true,
        deletedAt: true,
        memo: true,
        person: { select: { householdId: true } },
      },
    });
    if (!burial || burial.deletedAt !== null) {
      throw new Error('対象の納骨記録が見つかりませんでした。');
    }
    if (burial.removedAt !== null) {
      throw new Error('すでに改葬済みです。');
    }
    await tx.burial.update({
      where: { id: burialId },
      data: {
        removedAt,
        memo: appendReason(burial.memo, '改葬', reason),
      },
    });
    await recordAudit(tx, tenantId, {
      actorId: user.id,
      action: 'OTHER',
      entityType: 'Burial',
      entityId: burialId,
      summary: '改葬: Burial.removedAt セット',
    });
    return burial.person.householdId;
  });

  revalidatePath(`/kukaku/${gravePlotId}`);
  revalidatePath('/kukaku/map');
  revalidatePath('/kukaku');
  revalidatePath('/dashboard');
  if (householdId) revalidatePath(`/danshintoto/${householdId}`);
}

/**
 * 墓じまい (G-8): 契約解約。GraveContract.status = TERMINATED + GravePlot.status = CLOSED。
 */
export async function terminateGraveContractAction(
  formData: FormData,
): Promise<void> {
  const gravePlotId = readField(formData, 'gravePlotId');
  const contractId = readField(formData, 'contractId');
  assertValidUuid(gravePlotId, 'gravePlotId');
  assertValidUuid(contractId, 'graveContractId');

  const reason = requireReason(formData);

  const user = await requireCapability('destructive');
  const tenantId = user.tenantId;
  const householdId = await withTenant(tenantId, async (tx) => {
    const contract = await tx.graveContract.findUnique({
      where: { id: contractId },
      select: {
        deletedAt: true,
        status: true,
        gravePlotId: true,
        householdId: true,
        memo: true,
      },
    });
    if (!contract || contract.deletedAt !== null) {
      throw new Error('対象の契約が見つかりませんでした。');
    }
    if (contract.gravePlotId !== gravePlotId) {
      throw new Error('契約と区画が一致しません。');
    }
    if (contract.status === 'TERMINATED') {
      throw new Error('すでに解約済みです。');
    }
    await tx.graveContract.update({
      where: { id: contractId },
      data: {
        status: 'TERMINATED',
        memo: appendReason(contract.memo, '墓じまい', reason),
      },
    });
    await tx.gravePlot.update({
      where: { id: gravePlotId },
      data: { status: 'CLOSED' },
    });
    await recordAudit(tx, tenantId, {
      actorId: user.id,
      action: 'OTHER',
      entityType: 'GraveContract',
      entityId: contractId,
      summary: '墓じまい: GraveContract→TERMINATED, GravePlot→CLOSED',
    });
    return contract.householdId;
  });

  revalidatePath(`/kukaku/${gravePlotId}`);
  revalidatePath('/kukaku/map');
  revalidatePath('/kukaku');
  revalidatePath('/dashboard');
  if (householdId) revalidatePath(`/danshintoto/${householdId}`);
}

/**
 * 合祀移行 (G-8): 永代供養期限到来等で合祀へ。
 * GravePlot.status = INTERRED_TOGETHER (+ 契約があれば status = EXPIRED)。
 * removeRemainingBurials が明示 ON なら残存 Burial を removedAt で区画から出す (合祀墓へ移した記録)。
 */
export async function interTogetherAction(formData: FormData): Promise<void> {
  const gravePlotId = readField(formData, 'gravePlotId');
  assertValidUuid(gravePlotId, 'gravePlotId');

  const contractIdRaw = readField(formData, 'contractId');
  const contractId = contractIdRaw.length > 0 ? contractIdRaw : null;
  if (contractId !== null) {
    assertValidUuid(contractId, 'graveContractId');
  }
  const removeRemainingBurials = readField(formData, 'removeRemainingBurials') === 'on';

  const reason = requireReason(formData);

  const user = await requireCapability('destructive');
  const tenantId = user.tenantId;
  const householdId = await withTenant(tenantId, async (tx) => {
    const plot = await tx.gravePlot.findUnique({
      where: { id: gravePlotId },
      select: { status: true, householdId: true },
    });
    if (!plot) {
      throw new Error('対象の区画が見つかりませんでした。');
    }
    if (plot.status === 'INTERRED_TOGETHER') {
      throw new Error('すでに合祀済みです。');
    }
    await tx.gravePlot.update({
      where: { id: gravePlotId },
      data: { status: 'INTERRED_TOGETHER' },
    });
    if (contractId !== null) {
      const contract = await tx.graveContract.findUnique({
        where: { id: contractId },
        select: { deletedAt: true, gravePlotId: true, status: true, memo: true },
      });
      if (!contract || contract.deletedAt !== null) {
        throw new Error('対象の契約が見つかりませんでした。');
      }
      if (contract.gravePlotId !== gravePlotId) {
        throw new Error('契約と区画が一致しません。');
      }
      if (contract.status !== 'TERMINATED') {
        await tx.graveContract.update({
          where: { id: contractId },
          data: {
            status: 'EXPIRED',
            memo: appendReason(contract.memo, '合祀移行', reason),
          },
        });
      }
    }
    if (removeRemainingBurials) {
      await tx.burial.updateMany({
        where: { gravePlotId, removedAt: null, deletedAt: null },
        data: { removedAt: new Date() },
      });
    }
    await recordAudit(tx, tenantId, {
      actorId: user.id,
      action: 'OTHER',
      entityType: 'GravePlot',
      entityId: gravePlotId,
      summary: removeRemainingBurials
        ? '合祀移行: GravePlot→INTERRED_TOGETHER, 契約→EXPIRED, 残存Burial→removedAt'
        : '合祀移行: GravePlot→INTERRED_TOGETHER, 契約→EXPIRED',
    });
    return plot.householdId;
  });

  revalidatePath(`/kukaku/${gravePlotId}`);
  revalidatePath('/kukaku/map');
  revalidatePath('/kukaku');
  revalidatePath('/dashboard');
  if (householdId) revalidatePath(`/danshintoto/${householdId}`);
}
