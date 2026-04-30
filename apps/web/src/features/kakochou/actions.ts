'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireCurrentTenantId } from '@/lib/auth';
import { assertValidUuid, withTenant } from '@/lib/db';
import { formatWareki, seirekiToWareki } from '@/lib/wareki';
import type {
  DeathLedgerFieldName,
  DeathLedgerFormState,
} from './types';

function readField(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === 'string' ? v.trim() : '';
}

function nullIfBlank(value: string): string | null {
  return value.length === 0 ? null : value;
}

type DeathLedgerValues = Record<DeathLedgerFieldName, string>;

function extractValues(formData: FormData): DeathLedgerValues {
  return {
    secularName: readField(formData, 'secularName'),
    nameKana: readField(formData, 'nameKana'),
    kaimyoName: readField(formData, 'kaimyoName'),
    dateOfDeath: readField(formData, 'dateOfDeath'),
    ageAtDeath: readField(formData, 'ageAtDeath'),
    familyRelation: readField(formData, 'familyRelation'),
    burialLocation: readField(formData, 'burialLocation'),
    memo: readField(formData, 'memo'),
  };
}

type ParsedDate = { year: number; month: number; day: number; date: Date };

function parseIsoDate(iso: string): ParsedDate | null {
  // input[type=date] は YYYY-MM-DD 形式
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split('-').map((s) => Number.parseInt(s, 10));
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
  // Date のコンストラクタは日付を roll over させるので一致確認する
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() + 1 !== m ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  return { year: y, month: m, day: d, date };
}

/**
 * 西暦 YYYY-MM-DD の没年月日から和暦表記を組み立てる。
 * 明治以前・不正日付の場合は null を返す (DB は nullable)。
 */
function computeWarekiString(parsed: ParsedDate): string | null {
  try {
    const wareki = seirekiToWareki({
      year: parsed.year,
      month: parsed.month,
      day: parsed.day,
    });
    return formatWareki(wareki);
  } catch {
    return null;
  }
}

function validate(
  values: DeathLedgerValues,
): NonNullable<DeathLedgerFormState['errors']> {
  const errors: NonNullable<DeathLedgerFormState['errors']> = {};

  if (values.secularName.length === 0) {
    errors.secularName = '俗名をご入力ください。';
  } else if (values.secularName.length > 60) {
    errors.secularName = '60 文字以内でご入力ください。';
  }

  if (values.nameKana.length === 0) {
    errors.nameKana = 'ふりがなをご入力ください。';
  } else if (values.nameKana.length > 60) {
    errors.nameKana = '60 文字以内でご入力ください。';
  }

  if (values.kaimyoName.length > 120) {
    errors.kaimyoName = '120 文字以内でご入力ください。';
  }

  if (values.dateOfDeath.length === 0) {
    errors.dateOfDeath = '没年月日をご入力ください。';
  } else if (parseIsoDate(values.dateOfDeath) === null) {
    errors.dateOfDeath = '日付の形式が正しくありません。';
  }

  if (values.ageAtDeath.length > 0) {
    const n = Number.parseInt(values.ageAtDeath, 10);
    if (
      Number.isNaN(n) ||
      !Number.isFinite(n) ||
      n < 0 ||
      n > 150 ||
      String(n) !== values.ageAtDeath
    ) {
      errors.ageAtDeath = '行年は 0 〜 150 の整数でご入力ください。';
    }
  }

  return errors;
}

/**
 * 過去帳エントリの新規登録。
 * Person (isDeceased=true) と DeathLedgerEntry を同一トランザクションで作成する。
 * householdId は hidden input で受け取り、所属は RLS + `householdId` で二重に保証。
 */
export async function createDeathLedgerEntryAction(
  _prev: DeathLedgerFormState,
  formData: FormData,
): Promise<DeathLedgerFormState> {
  const householdId = readField(formData, 'householdId');
  if (householdId.length === 0) {
    return {
      status: 'error',
      errors: {},
      values: extractValues(formData),
    };
  }
  assertValidUuid(householdId, 'householdId');

  const values = extractValues(formData);
  const errors = validate(values);
  if (Object.keys(errors).length > 0) {
    return { status: 'error', errors, values };
  }

  const parsed = parseIsoDate(values.dateOfDeath);
  if (parsed === null) {
    // validate でも見ているので通常ここには来ないが、型の narrowing のため
    return {
      status: 'error',
      errors: { dateOfDeath: '日付の形式が正しくありません。' },
      values,
    };
  }

  const warekiString = computeWarekiString(parsed);
  const ageAtDeath =
    values.ageAtDeath.length > 0
      ? Number.parseInt(values.ageAtDeath, 10)
      : null;

  const tenantId = await requireCurrentTenantId();

  await withTenant(tenantId, async (tx) => {
    const person = await tx.person.create({
      data: {
        tenantId,
        householdId,
        name: values.secularName,
        nameKana: values.nameKana,
        familyRelation: nullIfBlank(values.familyRelation),
        isDeceased: true,
      },
    });
    await tx.deathLedgerEntry.create({
      data: {
        tenantId,
        personId: person.id,
        secularName: values.secularName,
        kaimyoName: nullIfBlank(values.kaimyoName),
        dateOfDeath: parsed.date,
        dateOfDeathWareki: warekiString,
        ageAtDeath,
        burialLocation: nullIfBlank(values.burialLocation),
        memo: nullIfBlank(values.memo),
      },
    });
  });

  revalidatePath(`/danshintoto/${householdId}`);
  redirect(`/danshintoto/${householdId}`);
}

/**
 * 過去帳エントリの編集。
 * Person の氏名・ふりがな・続柄も同時に同期させる (`DeathLedgerEntry.secularName` と
 * `Person.name` は実質 1 人の属性なので食い違わないようにする)。
 * RLS により他テナントの id は見えないので tenantId 検証は不要。
 */
export async function updateDeathLedgerEntryAction(
  _prev: DeathLedgerFormState,
  formData: FormData,
): Promise<DeathLedgerFormState> {
  const entryId = readField(formData, 'entryId');
  if (entryId.length === 0) {
    return {
      status: 'error',
      errors: {},
      values: extractValues(formData),
    };
  }
  assertValidUuid(entryId, 'deathLedgerEntryId');

  const values = extractValues(formData);
  const errors = validate(values);
  if (Object.keys(errors).length > 0) {
    return { status: 'error', errors, values };
  }

  const parsed = parseIsoDate(values.dateOfDeath);
  if (parsed === null) {
    return {
      status: 'error',
      errors: { dateOfDeath: '日付の形式が正しくありません。' },
      values,
    };
  }

  const warekiString = computeWarekiString(parsed);
  const ageAtDeath =
    values.ageAtDeath.length > 0
      ? Number.parseInt(values.ageAtDeath, 10)
      : null;

  const tenantId = await requireCurrentTenantId();

  const householdId = await withTenant(tenantId, async (tx) => {
    const entry = await tx.deathLedgerEntry.findUnique({
      where: { id: entryId },
      select: { personId: true, person: { select: { householdId: true } } },
    });
    if (!entry) {
      throw new Error('対象の過去帳エントリが見つかりませんでした。');
    }

    await tx.person.update({
      where: { id: entry.personId },
      data: {
        name: values.secularName,
        nameKana: values.nameKana,
        familyRelation: nullIfBlank(values.familyRelation),
      },
    });

    await tx.deathLedgerEntry.update({
      where: { id: entryId },
      data: {
        secularName: values.secularName,
        kaimyoName: nullIfBlank(values.kaimyoName),
        dateOfDeath: parsed.date,
        dateOfDeathWareki: warekiString,
        ageAtDeath,
        burialLocation: nullIfBlank(values.burialLocation),
        memo: nullIfBlank(values.memo),
      },
    });

    return entry.person.householdId;
  });

  revalidatePath(`/danshintoto/${householdId}`);
  redirect(`/danshintoto/${householdId}`);
}

/**
 * 過去帳エントリの論理削除 (CLAUDE.md §7: 物理削除は禁止)。
 * `deletedAt` をセットして一覧・年忌表から除外する。
 * Person 側の `isDeceased` はそのまま (故人記録は保持)。
 */
export async function softDeleteDeathLedgerEntryAction(
  formData: FormData,
): Promise<void> {
  const entryId = readField(formData, 'entryId');
  if (entryId.length === 0) {
    throw new Error('entryId is required.');
  }
  assertValidUuid(entryId, 'deathLedgerEntryId');

  const tenantId = await requireCurrentTenantId();

  const householdId = await withTenant(tenantId, async (tx) => {
    const entry = await tx.deathLedgerEntry.findUnique({
      where: { id: entryId },
      select: {
        deletedAt: true,
        person: { select: { householdId: true } },
      },
    });
    if (!entry) {
      throw new Error('対象の過去帳エントリが見つかりませんでした。');
    }
    if (entry.deletedAt !== null) {
      // 既に論理削除済み。冪等に成功扱い
      return entry.person.householdId;
    }

    await tx.deathLedgerEntry.update({
      where: { id: entryId },
      data: { deletedAt: new Date() },
    });

    return entry.person.householdId;
  });

  revalidatePath(`/danshintoto/${householdId}`);
  redirect(`/danshintoto/${householdId}`);
}
