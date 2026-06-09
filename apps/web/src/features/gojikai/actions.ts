'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireCapability } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { assertValidUuid, isValidUuid, withTenant } from '@/lib/db';
import {
  MAINTENANCE_FEE_CATEGORY,
  generateInvoiceDrafts,
  parseDbDate,
  parseFiscalYear,
  parsePaymentAmount,
  reconcilePayment,
  validatePlanInput,
  type FeePlanSource,
} from '@/lib/gojikai';
import { listDunningCandidatesForYear } from './queries';
import {
  type DunningRecordState,
  type GenerateFormState,
  type PaymentFormState,
  type PlanFormState,
} from './types';

function readField(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === 'string' ? v.trim() : '';
}

// =========================================
// 会費台帳 (MaintenanceFeePlan) の登録・更新
// =========================================

/**
 * 会費台帳の新規作成 / 更新 (1 世帯 1 台帳)。
 * householdId が自テナントの世帯であることを RLS 経由で確認してから upsert する。
 */
export async function saveFeePlanAction(
  _prev: PlanFormState,
  formData: FormData,
): Promise<PlanFormState> {
  const values = {
    householdId: readField(formData, 'householdId'),
    annualAmount: readField(formData, 'annualAmount'),
    method: readField(formData, 'method'),
    note: readField(formData, 'note'),
  };

  const v = validatePlanInput(values);
  const errors: NonNullable<PlanFormState['errors']> = { ...v.errors };

  if (!isValidUuid(values.householdId)) {
    errors.householdId = '世帯の指定が不正です。';
  }

  if (Object.keys(errors).length > 0) {
    return { status: 'error', errors, values };
  }

  const tenantId = (await requireCapability('update')).tenantId;

  const household = await withTenant(tenantId, (tx) =>
    tx.household.findUnique({
      where: { id: values.householdId },
      select: { id: true },
    }),
  );
  if (!household) {
    return {
      status: 'error',
      errors: { householdId: '指定された世帯が見つかりませんでした。' },
      values,
    };
  }

  await withTenant(tenantId, (tx) =>
    tx.maintenanceFeePlan.upsert({
      where: { householdId: values.householdId },
      create: {
        tenantId,
        householdId: values.householdId,
        annualAmount: v.values.annualAmount,
        method: v.values.method,
        note: v.values.note,
      },
      update: {
        annualAmount: v.values.annualAmount,
        method: v.values.method,
        note: v.values.note,
      },
    }),
  );

  revalidatePath('/gojikai');
  revalidatePath('/gojikai/daichou');
  revalidatePath(`/danshintoto/${values.householdId}`);
  redirect('/gojikai/daichou');
}

/** 会費台帳の休止 / 再開を切り替える (請求対象から外す)。 */
export async function toggleFeePlanActiveAction(
  formData: FormData,
): Promise<void> {
  const householdId = readField(formData, 'householdId');
  assertValidUuid(householdId, 'householdId');
  const tenantId = (await requireCapability('softDelete')).tenantId;

  await withTenant(tenantId, async (tx) => {
    const plan = await tx.maintenanceFeePlan.findUnique({
      where: { householdId },
      select: { id: true, isActive: true },
    });
    if (!plan) throw new Error('会費台帳が見つかりませんでした。');
    await tx.maintenanceFeePlan.update({
      where: { householdId },
      data: { isActive: !plan.isActive },
    });
  });

  revalidatePath('/gojikai/daichou');
  revalidatePath(`/danshintoto/${householdId}`);
}

// =========================================
// 年度請求の一括生成
// =========================================

/**
 * 指定年度の請求を台帳から一括生成する。
 * - 既に当年度の請求がある世帯は重複生成しない (純関数 generateInvoiceDrafts が判定)。
 * - 休止台帳は対象外。
 * - 生成は手動トリガ (画面のボタン)。死亡/期日起点の全自動パイプラインにはしない (特許回避)。
 */
export async function generateInvoicesAction(
  _prev: GenerateFormState,
  formData: FormData,
): Promise<GenerateFormState> {
  const fiscalYear = parseFiscalYear(readField(formData, 'fiscalYear'));
  if (fiscalYear === null) {
    return {
      status: 'error',
      formError: '年度が正しくありません。',
    };
  }

  const user = await requireCapability('create');
  const tenantId = user.tenantId;

  const result = await withTenant(tenantId, async (tx) => {
    const plans = await tx.maintenanceFeePlan.findMany({
      select: {
        householdId: true,
        annualAmount: true,
        method: true,
        isActive: true,
      },
      take: 5000,
    });

    const existing = await tx.maintenanceFeeInvoice.findMany({
      where: { fiscalYear },
      select: { householdId: true },
      take: 5000,
    });

    const gen = generateInvoiceDrafts(
      plans as FeePlanSource[],
      fiscalYear,
      existing.map((e) => e.householdId),
    );

    if (gen.drafts.length > 0) {
      await tx.maintenanceFeeInvoice.createMany({
        data: gen.drafts.map((d) => ({
          tenantId,
          householdId: d.householdId,
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
        entityType: 'MaintenanceFeeInvoice',
        summary: `護持会費 請求を一括生成 (${fiscalYear}年度, ${gen.drafts.length}件)`,
      });
    }

    return gen;
  });

  revalidatePath('/gojikai');
  revalidatePath(`/gojikai?year=${fiscalYear}`);

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
 * - 入金ぶんの会計 Transaction(category=MAINTENANCE_FEE, INCOME) を起票する。
 * - 二重起票防止: 1 請求につき自動起票する Transaction は 1 件まで (invoice.transactionId で管理)。
 *   既に紐づく Transaction があれば、その金額を「入金累計と同期」で更新する。
 */
export async function recordPaymentAction(
  _prev: PaymentFormState,
  formData: FormData,
): Promise<PaymentFormState> {
  const invoiceId = readField(formData, 'invoiceId');
  if (!isValidUuid(invoiceId)) {
    return {
      status: 'error',
      errors: { amount: '請求の指定が不正です。' },
    };
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

  let householdId: string | null = null;

  await withTenant(tenantId, async (tx) => {
    const invoice = await tx.maintenanceFeeInvoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        householdId: true,
        amount: true,
        paidAmount: true,
        transactionId: true,
      },
    });
    if (!invoice) throw new Error('対象の請求が見つかりませんでした。');
    householdId = invoice.householdId;

    const recon = reconcilePayment({
      amount: invoice.amount,
      currentPaidAmount: invoice.paidAmount,
      payment,
    });

    // 会計起票: 1 請求につき 1 Transaction を維持する (二重起票しない)。
    // 既に起票済みなら累計に同期して update、未起票なら新規 create して紐付ける。
    let transactionId = invoice.transactionId;
    if (transactionId) {
      await tx.transaction.update({
        where: { id: transactionId },
        data: {
          amount: recon.newPaidAmount,
          paidAt,
          paymentMethod,
        },
      });
    } else {
      const created = await tx.transaction.create({
        data: {
          tenantId,
          householdId: invoice.householdId,
          category: MAINTENANCE_FEE_CATEGORY,
          direction: 'INCOME',
          amount: recon.newPaidAmount,
          paidAt,
          paymentMethod,
          memo: '護持会費 入金 (請求消込)',
        },
        select: { id: true },
      });
      transactionId = created.id;
    }

    await tx.maintenanceFeeInvoice.update({
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
      entityType: 'MaintenanceFeeInvoice',
      entityId: invoiceId,
      summary: `護持会費 入金を消込 (status=${recon.status})`,
    });
  });

  revalidatePath('/gojikai');
  revalidatePath(`/gojikai/seikyu/${invoiceId}`);
  revalidatePath('/kaikei');
  if (householdId) revalidatePath(`/danshintoto/${householdId}`);
  redirect(`/gojikai/seikyu/${invoiceId}`);
}

// =========================================
// 督促状の発送記録 (未納抽出 → 確認 → 記録)
// =========================================

/**
 * 未納世帯への督促状 発送を記録する (特許回避: 手動トリガ + 送信前確認)。
 * 死亡/期日起点の全自動ではなく、住職が画面で対象を確認しボタンで記録する。
 *
 * - 宛先はサーバ側で再抽出する (クライアント送信値は信用しない)。
 * - 既存の発送基盤 (ShipmentBatch / ShipmentRecipient) を流用する。
 * - 各世帯のカルテ (InteractionNote) に督促履歴を 1 件ずつ残す。
 */
export async function recordDunningShipmentAction(
  _prev: DunningRecordState,
  formData: FormData,
): Promise<DunningRecordState> {
  const fiscalYear = parseFiscalYear(readField(formData, 'fiscalYear'));
  if (fiscalYear === null) {
    return { status: 'error', formError: '年度が正しくありません。' };
  }

  const candidates = await listDunningCandidatesForYear(fiscalYear);
  if (candidates.length === 0) {
    return {
      status: 'error',
      formError: '未集金の世帯がありません。発送対象をご確認ください。',
    };
  }

  const user = await requireCapability('create');
  const tenantId = user.tenantId;
  const title = `${fiscalYear} 年度 護持会費 納入のお願い`;

  try {
    const batchId = await withTenant(tenantId, async (tx) => {
      const batch = await tx.shipmentBatch.create({
        data: {
          tenantId,
          title,
          documentType: 'NOTICE_LETTER',
          targetYear: fiscalYear,
          recipientCount: candidates.length,
          sentById: user.id,
        },
        select: { id: true },
      });

      await tx.shipmentRecipient.createMany({
        data: candidates.map((c) => ({
          tenantId,
          batchId: batch.id,
          householdId: c.householdId,
          householderName: c.householderName,
          postalCode: c.postalCode,
          address: c.address,
          summary: `${fiscalYear} 年度 護持会費 未納 ${c.outstanding.toLocaleString('ja-JP')} 円`,
        })),
      });

      const occurredAt = new Date();
      await tx.interactionNote.createMany({
        data: candidates.map((c) => ({
          tenantId,
          householdId: c.householdId,
          authorId: user.id,
          kind: 'NOTE' as const,
          content: `護持会費の督促状を発送しました（${fiscalYear} 年度 / 未納 ${c.outstanding.toLocaleString('ja-JP')} 円）`,
          occurredAt,
        })),
      });

      await recordAudit(tx, tenantId, {
        actorId: user.id,
        action: 'OTHER',
        entityType: 'ShipmentBatch',
        entityId: batch.id,
        summary: `護持会費 督促状を発送記録 (${fiscalYear}年度, ${candidates.length}件)`,
      });

      return batch.id;
    });

    revalidatePath('/gojikai');
    revalidatePath('/hasso');
    candidates.forEach((c) => revalidatePath(`/danshintoto/${c.householdId}`));

    return { status: 'success', createdBatchId: batchId };
  } catch {
    return {
      status: 'error',
      formError: '督促状の記録に失敗しました。時間をおいて再度お試しください。',
    };
  }
}
