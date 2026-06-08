'use server';

import type { GraveContractStatus, GraveContractType } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireCapability } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { assertValidUuid, isValidUuid, withTenant } from '@/lib/db';
import { computeExpiryDate } from '@/lib/grave/contract';
import { parseIsoDate } from '@/lib/grave/date';
import type {
  GraveContractFieldName,
  GraveContractFormState,
} from './types';
import {
  GRAVE_CONTRACT_STATUS_ORDER,
  GRAVE_CONTRACT_TYPE_ORDER,
} from './types';

function readField(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === 'string' ? v.trim() : '';
}

function nullIfBlank(value: string): string | null {
  return value.length === 0 ? null : value;
}

type ContractValues = Record<GraveContractFieldName, string>;

function extractValues(formData: FormData): ContractValues {
  return {
    contractType: readField(formData, 'contractType'),
    householdId: readField(formData, 'householdId'),
    startDate: readField(formData, 'startDate'),
    termYears: readField(formData, 'termYears'),
    status: readField(formData, 'status'),
    feeAmount: readField(formData, 'feeAmount'),
    memo: readField(formData, 'memo'),
  };
}

type ValidatedContract = {
  errors: NonNullable<GraveContractFormState['errors']>;
  contractType: GraveContractType | null;
  householdId: string | null;
  startDate: Date | null;
  termYears: number | null;
  status: GraveContractStatus;
  feeAmount: number | null;
};

function validate(values: ContractValues): ValidatedContract {
  const errors: NonNullable<GraveContractFormState['errors']> = {};

  let contractType: GraveContractType | null = null;
  if (values.contractType.length === 0) {
    errors.contractType = '契約種別を選択してください。';
  } else if (
    (GRAVE_CONTRACT_TYPE_ORDER as string[]).includes(values.contractType)
  ) {
    contractType = values.contractType as GraveContractType;
  } else {
    errors.contractType = '契約種別の値が不正です。';
  }

  let householdId: string | null = null;
  if (values.householdId.length > 0) {
    if (isValidUuid(values.householdId)) {
      householdId = values.householdId;
    } else {
      errors.householdId = '契約世帯の選択が不正です。';
    }
  }

  let startDate: Date | null = null;
  if (values.startDate.length > 0) {
    startDate = parseIsoDate(values.startDate);
    if (startDate === null) {
      errors.startDate = '日付の形式が正しくありません。';
    }
  }

  let termYears: number | null = null;
  if (values.termYears.length > 0) {
    const n = Number.parseInt(values.termYears, 10);
    if (Number.isNaN(n) || n < 0 || n > 1000) {
      errors.termYears = '預かり年数は 0〜1000 の数値でご入力ください。';
    } else {
      termYears = n;
    }
  }

  let status: GraveContractStatus = 'ACTIVE';
  if (values.status.length > 0) {
    if ((GRAVE_CONTRACT_STATUS_ORDER as string[]).includes(values.status)) {
      status = values.status as GraveContractStatus;
    } else {
      errors.status = '契約状態の値が不正です。';
    }
  }

  let feeAmount: number | null = null;
  if (values.feeAmount.length > 0) {
    const n = Number.parseInt(values.feeAmount.replace(/[,\s]/g, ''), 10);
    if (Number.isNaN(n) || n < 0) {
      errors.feeAmount = '金額は 0 以上の数値でご入力ください。';
    } else {
      feeAmount = n;
    }
  }

  if (values.memo.length > 1000) {
    errors.memo = '1000 文字以内でご入力ください。';
  }

  return {
    errors,
    contractType,
    householdId,
    startDate,
    termYears,
    status,
    feeAmount,
  };
}

/**
 * 区画契約の新規登録。満了日は startDate+termYears をサーバー側で算出して保存する。
 */
export async function createGraveContractAction(
  _prev: GraveContractFormState,
  formData: FormData,
): Promise<GraveContractFormState> {
  const gravePlotId = readField(formData, 'gravePlotId');
  assertValidUuid(gravePlotId, 'gravePlotId');

  const values = extractValues(formData);
  const v = validate(values);
  if (Object.keys(v.errors).length > 0 || v.contractType === null) {
    return { status: 'error', errors: v.errors, values };
  }

  const expiryDate = computeExpiryDate(v.startDate, v.termYears);
  const tenantId = (await requireCapability('create')).tenantId;

  await withTenant(tenantId, (tx) =>
    tx.graveContract.create({
      data: {
        tenantId,
        gravePlotId,
        householdId: v.householdId,
        contractType: v.contractType!,
        startDate: v.startDate,
        termYears: v.termYears,
        expiryDate,
        status: v.status,
        feeAmount: v.feeAmount,
        memo: nullIfBlank(values.memo),
      },
    }),
  );

  revalidatePath(`/kukaku/${gravePlotId}`);
  revalidatePath('/kukaku/map');
  if (v.householdId) revalidatePath(`/danshintoto/${v.householdId}`);
  redirect(`/kukaku/${gravePlotId}`);
}

/**
 * 区画契約の編集。満了日を再算出して保存する。
 */
export async function updateGraveContractAction(
  _prev: GraveContractFormState,
  formData: FormData,
): Promise<GraveContractFormState> {
  const gravePlotId = readField(formData, 'gravePlotId');
  const contractId = readField(formData, 'contractId');
  assertValidUuid(gravePlotId, 'gravePlotId');
  assertValidUuid(contractId, 'graveContractId');

  const values = extractValues(formData);
  const v = validate(values);
  if (Object.keys(v.errors).length > 0 || v.contractType === null) {
    return { status: 'error', errors: v.errors, values };
  }

  const expiryDate = computeExpiryDate(v.startDate, v.termYears);
  const tenantId = (await requireCapability('update')).tenantId;

  const prevHouseholdId = await withTenant(tenantId, async (tx) => {
    const existing = await tx.graveContract.findUnique({
      where: { id: contractId },
      select: { householdId: true, deletedAt: true },
    });
    if (!existing || existing.deletedAt !== null) {
      throw new Error('対象の契約が見つかりませんでした。');
    }
    await tx.graveContract.update({
      where: { id: contractId },
      data: {
        householdId: v.householdId,
        contractType: v.contractType!,
        startDate: v.startDate,
        termYears: v.termYears,
        expiryDate,
        status: v.status,
        feeAmount: v.feeAmount,
        memo: nullIfBlank(values.memo),
      },
    });
    return existing.householdId;
  });

  revalidatePath(`/kukaku/${gravePlotId}`);
  revalidatePath('/kukaku/map');
  if (prevHouseholdId) revalidatePath(`/danshintoto/${prevHouseholdId}`);
  if (v.householdId && v.householdId !== prevHouseholdId) {
    revalidatePath(`/danshintoto/${v.householdId}`);
  }
  redirect(`/kukaku/${gravePlotId}`);
}

/**
 * 契約を論理削除する (誤登録の除外)。解約は status=TERMINATED で表すため別操作。物理削除はしない。
 */
export async function softDeleteGraveContractAction(
  formData: FormData,
): Promise<void> {
  const contractId = readField(formData, 'contractId');
  const gravePlotId = readField(formData, 'gravePlotId');
  assertValidUuid(contractId, 'graveContractId');
  assertValidUuid(gravePlotId, 'gravePlotId');

  const user = await requireCapability('softDelete');
  const tenantId = user.tenantId;
  const householdId = await withTenant(tenantId, async (tx) => {
    const existing = await tx.graveContract.findUnique({
      where: { id: contractId },
      select: { householdId: true },
    });
    await tx.graveContract.update({
      where: { id: contractId },
      data: { deletedAt: new Date() },
    });
    await recordAudit(tx, tenantId, {
      actorId: user.id,
      action: 'DELETE',
      entityType: 'GraveContract',
      entityId: contractId,
      summary: '区画契約を誤登録として除外 (論理削除)',
    });
    return existing?.householdId ?? null;
  });

  revalidatePath(`/kukaku/${gravePlotId}`);
  if (householdId) revalidatePath(`/danshintoto/${householdId}`);
}
