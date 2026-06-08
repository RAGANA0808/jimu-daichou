'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { PostalTransferAmountSource, Sect } from '@prisma/client';
import { requireCapability } from '@/lib/auth';
import { withTenant } from '@/lib/db';
import { recordAudit } from '@/lib/audit';
import { isValidSect, type SectKey } from '@/lib/nenki';
import type {
  SetupFieldName,
  SetupFormState,
  TenantSettingsFieldName,
  TenantSettingsFormState,
} from './types';

function readField(formData: FormData, name: TenantSettingsFieldName): string {
  const v = formData.get(name);
  return typeof v === 'string' ? v.trim() : '';
}

function nullIfBlank(value: string): string | null {
  return value.length === 0 ? null : value;
}

/**
 * 自テナントの表示用設定 (寺院名・住職氏名) を更新する。
 * slug は URL 識別子のため編集不可。
 */
export async function updateTenantSettingsAction(
  _prev: TenantSettingsFormState,
  formData: FormData,
): Promise<TenantSettingsFormState> {
  const values = {
    name: readField(formData, 'name'),
    headPriestName: readField(formData, 'headPriestName'),
    sect: readField(formData, 'sect'),
  };

  const errors: NonNullable<TenantSettingsFormState['errors']> = {};
  if (values.name.length === 0) {
    errors.name = '寺院名をご入力ください。';
  } else if (values.name.length > 60) {
    errors.name = '60 文字以内でご入力ください。';
  }

  if (values.headPriestName.length > 60) {
    errors.headPriestName = '60 文字以内でご入力ください。';
  }

  // sect: 空文字=未設定 OK。値があれば既知の enum でなければエラー。
  let sectValue: SectKey | null = null;
  if (values.sect.length > 0) {
    if (isValidSect(values.sect)) {
      sectValue = values.sect;
    } else {
      errors.sect = '宗派の選択が不正です。';
    }
  }

  if (Object.keys(errors).length > 0) {
    return { status: 'error', errors, values };
  }

  const tenantId = (await requireCapability('admin')).tenantId;
  await withTenant(tenantId, (tx) =>
    tx.tenant.update({
      where: { id: tenantId },
      data: {
        name: values.name,
        headPriestName: nullIfBlank(values.headPriestName),
        sect: sectValue as Sect | null,
      },
    }),
  );

  revalidatePath('/settings');
  revalidatePath('/dashboard');
  redirect('/settings');
}

/**
 * 初期設定ウィザードで作成する既定の郵便振替科目テンプレ (任意)。
 * 護持会費のみ E07 連動 (当年度請求額)。お布施・寄付は連動なし。
 * 墓地管理費は区画単位で世帯導線が異なるためプリセットには含めない。
 */
const DEFAULT_SUBJECT_PRESETS: ReadonlyArray<{
  name: string;
  defaultAmount: number;
  amountSource: PostalTransferAmountSource;
  sortOrder: number;
}> = [
  { name: '護持会費', defaultAmount: 0, amountSource: 'MAINTENANCE_FEE', sortOrder: 0 },
  { name: 'お布施', defaultAmount: 0, amountSource: 'NONE', sortOrder: 1 },
  { name: '寄付', defaultAmount: 0, amountSource: 'NONE', sortOrder: 2 },
];

function readSetupField(formData: FormData, name: SetupFieldName): string {
  const v = formData.get(name);
  return typeof v === 'string' ? v.trim() : '';
}

/**
 * 初期設定ウィザードの完了。寺院情報・宗派・郵便口座をまとめて保存し、
 * 任意で選択された既定科目を冪等に作成する。
 * Tenant 更新を主目的とするため監査は entityType:'Tenant' で 1 行に集約する。
 */
export async function completeTenantSetupAction(
  _prev: SetupFormState,
  formData: FormData,
): Promise<SetupFormState> {
  const values: Record<SetupFieldName, string> = {
    name: readSetupField(formData, 'name'),
    headPriestName: readSetupField(formData, 'headPriestName'),
    sect: readSetupField(formData, 'sect'),
    postalAccountName: readSetupField(formData, 'postalAccountName'),
    postalAccountSymbol: readSetupField(formData, 'postalAccountSymbol'),
    postalAccountNumber: readSetupField(formData, 'postalAccountNumber'),
    postalTransferNote: readSetupField(formData, 'postalTransferNote'),
  };

  const selectedPresetNames = formData
    .getAll('presetSubjects')
    .filter((v): v is string => typeof v === 'string');

  const errors: NonNullable<SetupFormState['errors']> = {};

  if (values.name.length === 0) {
    errors.name = '寺院名をご入力ください。';
  } else if (values.name.length > 60) {
    errors.name = '60 文字以内でご入力ください。';
  }

  if (values.headPriestName.length > 60) {
    errors.headPriestName = '60 文字以内でご入力ください。';
  }

  let sectValue: SectKey | null = null;
  if (values.sect.length > 0) {
    if (isValidSect(values.sect)) {
      sectValue = values.sect;
    } else {
      errors.sect = '宗派の選択が正しくありません。';
    }
  }

  if (values.postalAccountName.length > 60) {
    errors.postalAccountName = '60 文字以内でご入力ください。';
  }
  if (values.postalAccountSymbol.length > 20) {
    errors.postalAccountSymbol = '20 文字以内でご入力ください。';
  }
  if (values.postalAccountNumber.length > 20) {
    errors.postalAccountNumber = '20 文字以内でご入力ください。';
  }
  if (values.postalTransferNote.length > 200) {
    errors.postalTransferNote = '200 文字以内でご入力ください。';
  }

  if (Object.keys(errors).length > 0) {
    return { status: 'error', errors, values };
  }

  const user = await requireCapability('admin');
  const tenantId = user.tenantId;

  const postalFilledCount = [
    values.postalAccountName,
    values.postalAccountSymbol,
    values.postalAccountNumber,
    values.postalTransferNote,
  ].filter((v) => v.length > 0).length;

  try {
    await withTenant(tenantId, async (tx) => {
      await tx.tenant.update({
        where: { id: tenantId },
        data: {
          name: values.name,
          headPriestName: nullIfBlank(values.headPriestName),
          sect: sectValue as Sect | null,
          postalAccountName: nullIfBlank(values.postalAccountName),
          postalAccountSymbol: nullIfBlank(values.postalAccountSymbol),
          postalAccountNumber: nullIfBlank(values.postalAccountNumber),
          postalTransferNote: nullIfBlank(values.postalTransferNote),
        },
      });

      // Step3: 選択された既定科目を「未存在なら」作成 (冪等)。
      // PostalTransferSubject には (tenantId,name) のユニーク制約が無いため、
      // 事前 findMany で既存 name を除外してから作る (skipDuplicates は使えない)。
      let createdSubjectCount = 0;
      if (selectedPresetNames.length > 0) {
        const existing = await tx.postalTransferSubject.findMany({
          where: { name: { in: selectedPresetNames } },
          select: { name: true },
        });
        const existingNames = new Set(existing.map((s) => s.name));
        const toCreate = DEFAULT_SUBJECT_PRESETS.filter(
          (p) => selectedPresetNames.includes(p.name) && !existingNames.has(p.name),
        );
        if (toCreate.length > 0) {
          await tx.postalTransferSubject.createMany({
            data: toCreate.map((p) => ({
              tenantId,
              name: p.name,
              defaultAmount: p.defaultAmount,
              amountSource: p.amountSource,
              sortOrder: p.sortOrder,
            })),
          });
          createdSubjectCount = toCreate.length;
        }
      }

      await recordAudit(tx, tenantId, {
        actorId: user.id,
        action: 'UPDATE',
        entityType: 'Tenant',
        entityId: tenantId,
        summary: `setup: sect=${sectValue ?? 'NULL'} postal=${postalFilledCount}/4 subjects=+${createdSubjectCount}`,
      });
    });
  } catch {
    return {
      status: 'error',
      values,
      formError: '初期設定の保存に失敗しました。時間をおいて再度お試しください。',
    };
  }

  revalidatePath('/settings');
  revalidatePath('/dashboard');
  redirect('/settings?setup=done');
}
