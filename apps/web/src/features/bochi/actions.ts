'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireCapability } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { assertValidUuid, isValidUuid, withTenant } from '@/lib/db';
import {
  GRAVE_MAINTENANCE_CATEGORY,
  GRAVE_MAINTENANCE_TRANSACTION_MEMO,
  generateInvoiceDrafts,
  parseDbDate,
  parseFiscalYear,
  parsePaymentAmount,
  reconcilePayment,
  validatePlanInput,
  type GravePlanSource,
} from '@/lib/bochi';
import { listDemandCandidates } from './queries';
import {
  type DemandRecordState,
  type GenerateFormState,
  type PaymentFormState,
  type PlanFormState,
} from './types';

function readField(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === 'string' ? v.trim() : '';
}

// =========================================
// 管理料台帳 (GraveMaintenancePlan) の登録・更新
// =========================================

/**
 * 管理料台帳の新規作成 / 更新 (1 区画 1 台帳)。
 * gravePlotId が自テナントの区画であることを RLS 経由で確認してから upsert する。
 */
export async function saveGravePlanAction(
  _prev: PlanFormState,
  formData: FormData,
): Promise<PlanFormState> {
  const values = {
    gravePlotId: readField(formData, 'gravePlotId'),
    annualAmount: readField(formData, 'annualAmount'),
    method: readField(formData, 'method'),
    basis: readField(formData, 'basis'),
    note: readField(formData, 'note'),
  };

  const v = validatePlanInput(values);
  const errors: NonNullable<PlanFormState['errors']> = { ...v.errors };

  if (!isValidUuid(values.gravePlotId)) {
    errors.gravePlotId = '区画の指定が不正です。';
  }

  if (Object.keys(errors).length > 0) {
    return { status: 'error', errors, values };
  }

  const tenantId = (await requireCapability('update')).tenantId;

  const plot = await withTenant(tenantId, (tx) =>
    tx.gravePlot.findUnique({
      where: { id: values.gravePlotId },
      select: { id: true },
    }),
  );
  if (!plot) {
    return {
      status: 'error',
      errors: { gravePlotId: '指定された区画が見つかりませんでした。' },
      values,
    };
  }

  await withTenant(tenantId, (tx) =>
    tx.graveMaintenancePlan.upsert({
      where: { gravePlotId: values.gravePlotId },
      create: {
        tenantId,
        gravePlotId: values.gravePlotId,
        annualAmount: v.values.annualAmount,
        method: v.values.method,
        basis: v.values.basis,
        note: v.values.note,
      },
      update: {
        annualAmount: v.values.annualAmount,
        method: v.values.method,
        basis: v.values.basis,
        note: v.values.note,
      },
    }),
  );

  revalidatePath('/bochi');
  revalidatePath('/bochi/daichou');
  revalidatePath(`/kukaku/${values.gravePlotId}`);
  redirect('/bochi/daichou');
}

/** 管理料台帳の休止 / 再開を切り替える (請求対象から外す)。 */
export async function toggleGravePlanActiveAction(
  formData: FormData,
): Promise<void> {
  const gravePlotId = readField(formData, 'gravePlotId');
  assertValidUuid(gravePlotId, 'gravePlotId');
  const tenantId = (await requireCapability('softDelete')).tenantId;

  await withTenant(tenantId, async (tx) => {
    const plan = await tx.graveMaintenancePlan.findUnique({
      where: { gravePlotId },
      select: { id: true, isActive: true },
    });
    if (!plan) throw new Error('管理料台帳が見つかりませんでした。');
    await tx.graveMaintenancePlan.update({
      where: { gravePlotId },
      data: { isActive: !plan.isActive },
    });
  });

  revalidatePath('/bochi/daichou');
  revalidatePath(`/kukaku/${gravePlotId}`);
}

// =========================================
// 年度請求の一括生成
// =========================================

/**
 * 指定年度の請求を台帳から一括生成する。
 * - 既に当年度の請求がある区画は重複生成しない (純関数 generateInvoiceDrafts が判定)。
 * - 休止台帳は対象外。
 * - 生成は手動トリガ (画面のボタン)。期日起点の全自動パイプラインにはしない (特許回避)。
 */
export async function generateInvoicesAction(
  _prev: GenerateFormState,
  formData: FormData,
): Promise<GenerateFormState> {
  const fiscalYear = parseFiscalYear(readField(formData, 'fiscalYear'));
  if (fiscalYear === null) {
    return { status: 'error', formError: '年度が正しくありません。' };
  }

  const user = await requireCapability('create');
  const tenantId = user.tenantId;

  const result = await withTenant(tenantId, async (tx) => {
    const plans = await tx.graveMaintenancePlan.findMany({
      select: {
        gravePlotId: true,
        annualAmount: true,
        method: true,
        isActive: true,
      },
      take: 5000,
    });

    const existing = await tx.graveMaintenanceInvoice.findMany({
      where: { fiscalYear },
      select: { gravePlotId: true },
      take: 5000,
    });

    const gen = generateInvoiceDrafts(
      plans as GravePlanSource[],
      fiscalYear,
      existing.map((e) => e.gravePlotId),
    );

    if (gen.drafts.length > 0) {
      await tx.graveMaintenanceInvoice.createMany({
        data: gen.drafts.map((d) => ({
          tenantId,
          gravePlotId: d.gravePlotId,
          fiscalYear: d.fiscalYear,
          amount: d.amount,
          method: d.method,
          status: 'UNPAID' as const,
          paidAmount: 0,
        })),
      });
      await recordAudit(tx, tenantId, {
        actorId: user.id,
        action: 'CREATE',
        entityType: 'GraveMaintenanceInvoice',
        summary: `墓地管理料 請求を一括生成 (${fiscalYear}年度, ${gen.drafts.length}件)`,
      });
    }

    return gen;
  });

  revalidatePath('/bochi');
  revalidatePath(`/bochi?year=${fiscalYear}`);

  return {
    status: 'success',
    fiscalYear,
    created: result.drafts.length,
    skippedExisting: result.skippedExisting,
    skippedInactive: result.skippedInactive,
  };
}

// =========================================
// 入金消込 (会計 Transaction 自動起票・二重起票しない)
// =========================================

/**
 * 請求への入金を記録する。
 *
 * - paidAmount を加算し status を判定 (純関数 reconcilePayment)。
 * - 入金累計ぶんの会計 Transaction(category=OTHER, INCOME, memo=墓地管理料) を起票する。
 *   会計科目体系 (E08) を前提にしないため OTHER + memo で護持会費 (MAINTENANCE_FEE) と区別する。
 * - 二重起票防止: 1 請求につき自動起票する Transaction は 1 件まで (invoice.transactionId で管理)。
 *   既に紐づく Transaction があれば、その金額を「入金累計と同期」で更新する。
 */
export async function recordPaymentAction(
  _prev: PaymentFormState,
  formData: FormData,
): Promise<PaymentFormState> {
  const invoiceId = readField(formData, 'invoiceId');
  if (!isValidUuid(invoiceId)) {
    return { status: 'error', errors: { amount: '請求の指定が不正です。' } };
  }

  const values = {
    amount: readField(formData, 'amount'),
    paidAt: readField(formData, 'paidAt'),
    paymentMethod: readField(formData, 'paymentMethod'),
  };

  const errors: NonNullable<PaymentFormState['errors']> = {};

  const payment = parsePaymentAmount(values.amount);
  if (payment === null) {
    errors.amount = '入金額は 1 〜 10,000,000 の整数 (円) でご入力ください。';
  }

  const paidAt = parseDbDate(values.paidAt);
  if (paidAt === null) {
    errors.paidAt = '入金日の形式が正しくありません。';
  }

  if (Object.keys(errors).length > 0 || payment === null || paidAt === null) {
    return { status: 'error', errors, values };
  }

  const user = await requireCapability('create');
  const tenantId = user.tenantId;
  const paymentMethod =
    values.paymentMethod.length > 0 ? values.paymentMethod : null;

  await withTenant(tenantId, async (tx) => {
    const invoice = await tx.graveMaintenanceInvoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        gravePlotId: true,
        amount: true,
        paidAmount: true,
        transactionId: true,
        gravePlot: { select: { householdId: true } },
      },
    });
    if (!invoice) throw new Error('対象の請求が見つかりませんでした。');

    const recon = reconcilePayment({
      amount: invoice.amount,
      currentPaidAmount: invoice.paidAmount,
      payment,
    });

    // 会計起票: 1 請求につき 1 Transaction を維持する (二重起票しない)。
    // 区画の契約世帯があれば householdId を紐付ける (会計上の世帯トレース)。
    let transactionId = invoice.transactionId;
    if (transactionId) {
      await tx.transaction.update({
        where: { id: transactionId },
        data: { amount: recon.newPaidAmount, paidAt, paymentMethod },
      });
    } else {
      const created = await tx.transaction.create({
        data: {
          tenantId,
          householdId: invoice.gravePlot.householdId,
          category: GRAVE_MAINTENANCE_CATEGORY,
          direction: 'INCOME',
          amount: recon.newPaidAmount,
          paidAt,
          paymentMethod,
          memo: GRAVE_MAINTENANCE_TRANSACTION_MEMO,
        },
        select: { id: true },
      });
      transactionId = created.id;
    }

    await tx.graveMaintenanceInvoice.update({
      where: { id: invoiceId },
      data: {
        paidAmount: recon.newPaidAmount,
        status: recon.status,
        transactionId,
      },
    });

    await recordAudit(tx, tenantId, {
      actorId: user.id,
      action: 'OTHER',
      entityType: 'GraveMaintenanceInvoice',
      entityId: invoiceId,
      summary: `墓地管理料 入金を消込 (status=${recon.status})`,
    });
  });

  revalidatePath('/bochi');
  revalidatePath(`/bochi/seikyu/${invoiceId}`);
  revalidatePath('/bochi/tainou');
  revalidatePath('/kaikei');
  redirect(`/bochi/seikyu/${invoiceId}`);
}

// =========================================
// 催告状の発送記録 (滞納抽出 → 確認 → 記録)
// =========================================

/**
 * 滞納区画への催告状 発送を記録する (特許回避: 手動トリガ + 送信前確認)。
 * 期日起点の全自動ではなく、住職が画面で対象を確認しボタンで記録する。
 *
 * - 宛先はサーバ側で再抽出する (クライアント送信値は信用しない)。
 * - 宛名解決できない区画 (契約世帯なし) は発送対象から自動的に除外する。
 * - 既存の発送基盤 (ShipmentBatch / ShipmentRecipient) を流用する。
 * - 各契約世帯のカルテ (InteractionNote) に催告履歴を 1 件ずつ残す。
 */
export async function recordDemandShipmentAction(
  _prev: DemandRecordState,
  formData: FormData,
): Promise<DemandRecordState> {
  const fiscalYear = parseFiscalYear(readField(formData, 'fiscalYear'));
  if (fiscalYear === null) {
    return { status: 'error', formError: '年度が正しくありません。' };
  }

  // 催告回 (第何回催告か)。1〜20 の範囲で受ける。既定 1。
  const roundRaw = readField(formData, 'round');
  const round = /^\d{1,2}$/.test(roundRaw)
    ? Math.min(20, Math.max(1, Number.parseInt(roundRaw, 10)))
    : 1;

  const candidates = await listDemandCandidates(fiscalYear);
  // 宛名解決できる (契約世帯あり) 区画のみ発送対象にする。
  const sendable = candidates.filter((c) => c.householdId !== null);
  if (sendable.length === 0) {
    return {
      status: 'error',
      formError:
        '宛名を解決できる滞納区画がありません。区画に契約世帯が登録されているかご確認ください。',
    };
  }

  const user = await requireCapability('create');
  const tenantId = user.tenantId;
  const title = `${fiscalYear} 年度 墓地管理料 催告 (第 ${round} 回)`;

  try {
    const batchId = await withTenant(tenantId, async (tx) => {
      const batch = await tx.shipmentBatch.create({
        data: {
          tenantId,
          title,
          documentType: 'NOTICE_LETTER',
          targetYear: fiscalYear,
          recipientCount: sendable.length,
          sentById: user.id,
        },
        select: { id: true },
      });

      await tx.shipmentRecipient.createMany({
        data: sendable.map((c) => ({
          tenantId,
          batchId: batch.id,
          householdId: c.householdId,
          householderName: c.householderName ?? '（宛名未設定）',
          postalCode: c.postalCode,
          address: c.address,
          summary: `区画 ${c.plotNumber} / 墓地管理料 未納 ${c.totalOutstanding.toLocaleString('ja-JP')} 円 (第 ${round} 回催告)`,
        })),
      });

      const occurredAt = new Date();
      await tx.interactionNote.createMany({
        data: sendable.map((c) => ({
          tenantId,
          householdId: c.householdId!,
          authorId: user.id,
          kind: 'NOTE' as const,
          content: `墓地管理料の催告状を発送しました（区画 ${c.plotNumber} / ${fiscalYear} 年度 / 未納 ${c.totalOutstanding.toLocaleString('ja-JP')} 円 / 第 ${round} 回催告）`,
          occurredAt,
        })),
      });

      await recordAudit(tx, tenantId, {
        actorId: user.id,
        action: 'OTHER',
        entityType: 'ShipmentBatch',
        entityId: batch.id,
        summary: `墓地管理料 催告状を発送記録 (${fiscalYear}年度, 第${round}回, ${sendable.length}件)`,
      });

      return batch.id;
    });

    revalidatePath('/bochi');
    revalidatePath('/bochi/tainou');
    revalidatePath('/hasso');
    sendable.forEach((c) => {
      if (c.householdId) revalidatePath(`/danshintoto/${c.householdId}`);
    });

    return { status: 'success', createdBatchId: batchId };
  } catch {
    return {
      status: 'error',
      formError: '催告状の記録に失敗しました。時間をおいて再度お試しください。',
    };
  }
}
