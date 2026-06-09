'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireCapability } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import {
  assertNotStale,
  assertValidUuid,
  isStaleError,
  withTenant,
} from '@/lib/db';
import {
  findDuplicateBySecularName,
  parseDeathDate,
  type DeathDateError,
  type NormalizedDeathDate,
} from '@/lib/kakochou';
import { isValidMemorialCutoff } from '@/lib/nenki';
import { formatWareki, seirekiToWareki } from '@/lib/wareki';
import { maybeProposeSuccessionOnDeath } from '@/features/danshintoto/succession-actions';
import type { DeathLedgerFieldName, DeathLedgerFormState } from './types';

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
    deathYear: readField(formData, 'deathYear'),
    deathMonth: readField(formData, 'deathMonth'),
    deathDay: readField(formData, 'deathDay'),
    ageAtDeath: readField(formData, 'ageAtDeath'),
    familyRelation: readField(formData, 'familyRelation'),
    burialLocation: readField(formData, 'burialLocation'),
    memorialCutoffAnniversary: readField(formData, 'memorialCutoffAnniversary'),
    memo: readField(formData, 'memo'),
  };
}

/**
 * 弔い上げ回忌の入力値を解釈する。
 * 空文字 (= 既定) は null、それ以外は 33/50 等の有効値のみ受け付ける。
 * 不正値は無効を表す `false` を返す。
 */
function parseMemorialCutoff(value: string): number | null | false {
  if (value.length === 0) return null;
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n) || String(n) !== value || !isValidMemorialCutoff(n)) {
    return false;
  }
  return n;
}

/** 数値欄を「未入力=null / 整数=number / 不正=NaN」に解釈する。 */
function parseIntField(value: string): number | null {
  if (value.length === 0) return null;
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n) || String(n) !== value) return Number.NaN;
  return n;
}

const DEATH_DATE_ERROR_MESSAGE: Record<DeathDateError, string> = {
  year_required_for_month: '月を入力する場合は没年もご入力ください。',
  month_required_for_day: '日を入力する場合は没月もご入力ください。',
  year_out_of_range: '没年が正しくありません。',
  month_out_of_range: '没月は 1〜12 でご入力ください。',
  day_out_of_range: '没日は 1〜31 でご入力ください。',
  invalid_calendar_date: '実在しない日付です。ご確認ください。',
};

/**
 * 西暦の没年月日 (FULL のみ) から和暦表記を組み立てる。
 * 明治以前・年のみ判明等で組み立てられない場合は null を返す。
 */
function computeWarekiString(parsed: NormalizedDeathDate): string | null {
  if (parsed.precision !== 'FULL' || parsed.year === null || parsed.month === null || parsed.day === null) {
    return null;
  }
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

type Validated =
  | { ok: false; state: DeathLedgerFormState }
  | { ok: true; values: DeathLedgerValues; deathDate: NormalizedDeathDate; ageAtDeath: number | null; memorialCutoff: number | null };

/**
 * 共通バリデーション。氏名・没年月日 (柔軟)・行年・弔い上げ回忌を検証し、
 * DB 書き込み用の正規化済み値まで作る。
 */
function validateAndNormalize(values: DeathLedgerValues): Validated {
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

  const year = parseIntField(values.deathYear);
  const month = parseIntField(values.deathMonth);
  const day = parseIntField(values.deathDay);
  if (Number.isNaN(year)) errors.deathYear = '没年は数値でご入力ください。';
  if (Number.isNaN(month)) errors.deathMonth = '没月は数値でご入力ください。';
  if (Number.isNaN(day)) errors.deathDay = '没日は数値でご入力ください。';

  let deathDate: NormalizedDeathDate | null = null;
  if (!Number.isNaN(year) && !Number.isNaN(month) && !Number.isNaN(day)) {
    const parsed = parseDeathDate({ year, month, day });
    if (!parsed.ok) {
      // どのエラーかに応じて該当欄へ寄せる。
      const message = DEATH_DATE_ERROR_MESSAGE[parsed.error];
      if (parsed.error === 'year_required_for_month' || parsed.error === 'year_out_of_range') {
        errors.deathYear = message;
      } else if (parsed.error === 'month_required_for_day' || parsed.error === 'month_out_of_range') {
        errors.deathMonth = message;
      } else {
        errors.deathDay = message;
      }
    } else {
      deathDate = parsed.value;
    }
  }

  let ageAtDeath: number | null = null;
  const ageRaw = parseIntField(values.ageAtDeath);
  if (Number.isNaN(ageRaw)) {
    errors.ageAtDeath = '行年は 0 〜 150 の整数でご入力ください。';
  } else if (ageRaw !== null && (ageRaw < 0 || ageRaw > 150)) {
    errors.ageAtDeath = '行年は 0 〜 150 の整数でご入力ください。';
  } else {
    ageAtDeath = ageRaw;
  }

  const memorialCutoff = parseMemorialCutoff(values.memorialCutoffAnniversary);
  if (memorialCutoff === false) {
    errors.memorialCutoffAnniversary = '弔い上げ回忌の指定が正しくありません。';
  }

  if (Object.keys(errors).length > 0 || deathDate === null || memorialCutoff === false) {
    return { ok: false, state: { status: 'error', errors, values } };
  }

  return {
    ok: true,
    values,
    deathDate,
    ageAtDeath,
    memorialCutoff,
  };
}

/** 正規化済み没年月日を DB 書き込み用フィールドへ展開する。 */
function deathDateData(d: NormalizedDeathDate) {
  return {
    dateOfDeath: d.date,
    deathYear: d.year,
    deathMonth: d.month,
    deathDay: d.day,
    datePrecision: d.precision,
    dateOfDeathWareki: computeWarekiString(d),
  };
}

/**
 * 過去帳エントリの新規登録。
 * Person (isDeceased=true) と DeathLedgerEntry を同一トランザクションで作成する。
 * 同一世帯に同名の故人が既にいる場合は警告し、`confirmDuplicate=true` で続行できる。
 */
export async function createDeathLedgerEntryAction(
  _prev: DeathLedgerFormState,
  formData: FormData,
): Promise<DeathLedgerFormState> {
  const householdId = readField(formData, 'householdId');
  if (householdId.length === 0) {
    return { status: 'error', errors: {}, values: extractValues(formData) };
  }
  assertValidUuid(householdId, 'householdId');

  const values = extractValues(formData);
  const validated = validateAndNormalize(values);
  if (!validated.ok) {
    return validated.state;
  }

  const confirmDuplicate = readField(formData, 'confirmDuplicate') === 'true';
  const user = await requireCapability('create');
  const tenantId = user.tenantId;

  // 1) 重複チェック (確認前のみ)。候補があれば登録せず警告を返す。
  if (!confirmDuplicate) {
    const existing = await withTenant(tenantId, (tx) =>
      tx.deathLedgerEntry.findMany({
        where: { deletedAt: null, person: { is: { householdId } } },
        select: { id: true, secularName: true },
      }),
    );
    const dups = findDuplicateBySecularName(values.secularName, existing);
    if (dups.length > 0) {
      return {
        status: 'error',
        values,
        duplicateWarning: { names: dups.map((d) => d.secularName) },
      };
    }
  }

  // 2) 登録 (Person + DeathLedgerEntry を 1 トランザクションで)。
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
    const entry = await tx.deathLedgerEntry.create({
      data: {
        tenantId,
        personId: person.id,
        secularName: values.secularName,
        kaimyoName: nullIfBlank(values.kaimyoName),
        ...deathDateData(validated.deathDate),
        ageAtDeath: validated.ageAtDeath,
        burialLocation: nullIfBlank(values.burialLocation),
        memorialCutoffAnniversary: validated.memorialCutoff,
        memo: nullIfBlank(values.memo),
      },
      select: { id: true },
    });

    // C-7: 故人が施主と推定される場合に承継候補 (PROPOSED) を起票する。
    // 【特許回避】次施主は設定せず、Household.householderName も書き換えない (承認は手動)。
    await maybeProposeSuccessionOnDeath(tx, {
      tenantId,
      householdId,
      deceasedPersonId: person.id,
      deceasedSecularName: values.secularName,
      occurredAt: validated.deathDate.date,
    });

    await recordAudit(tx, tenantId, {
      actorId: user.id,
      action: 'CREATE',
      entityType: 'DeathLedgerEntry',
      entityId: entry.id,
      summary: '過去帳エントリを新規登録',
    });
  });

  revalidatePath(`/danshintoto/${householdId}`);
  revalidatePath('/kakochou');
  redirect(`/danshintoto/${householdId}`);
}

/**
 * 過去帳エントリの編集。
 * Person の氏名・ふりがな・続柄も同時に同期させる。
 * RLS により他テナントの id は見えないので tenantId 検証は不要。
 */
export async function updateDeathLedgerEntryAction(
  _prev: DeathLedgerFormState,
  formData: FormData,
): Promise<DeathLedgerFormState> {
  const entryId = readField(formData, 'entryId');
  if (entryId.length === 0) {
    return { status: 'error', errors: {}, values: extractValues(formData) };
  }
  assertValidUuid(entryId, 'deathLedgerEntryId');

  const values = extractValues(formData);
  const validated = validateAndNormalize(values);
  if (!validated.ok) {
    return validated.state;
  }

  // M-5: 楽観ロックトークン (epoch ms 文字列)。空なら検証をスキップ (後方互換)。
  const expectedUpdatedAt = readField(formData, 'expectedUpdatedAt');

  const user = await requireCapability('update');
  const tenantId = user.tenantId;

  let householdId: string;
  try {
    householdId = await withTenant(tenantId, async (tx) => {
      const entry = await tx.deathLedgerEntry.findUnique({
        where: { id: entryId },
        select: {
          personId: true,
          updatedAt: true,
          person: { select: { householdId: true } },
        },
      });
      if (!entry) {
        throw new Error('対象の過去帳エントリが見つかりませんでした。');
      }
      if (expectedUpdatedAt.length > 0) {
        assertNotStale(expectedUpdatedAt, entry.updatedAt);
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
          ...deathDateData(validated.deathDate),
          ageAtDeath: validated.ageAtDeath,
          burialLocation: nullIfBlank(values.burialLocation),
          memorialCutoffAnniversary: validated.memorialCutoff,
          memo: nullIfBlank(values.memo),
        },
      });

      await recordAudit(tx, tenantId, {
        actorId: user.id,
        action: 'UPDATE',
        entityType: 'DeathLedgerEntry',
        entityId: entryId,
        summary: '過去帳エントリを編集',
      });

      return entry.person.householdId;
    });
  } catch (e) {
    if (isStaleError(e)) {
      return {
        status: 'error',
        values,
        formError:
          '他の方がこの内容を更新されました。最新の内容を読み込み直してください。',
      };
    }
    throw e;
  }

  revalidatePath(`/danshintoto/${householdId}`);
  revalidatePath('/kakochou');
  redirect(`/danshintoto/${householdId}`);
}

/**
 * 過去帳エントリの論理削除 (CLAUDE.md §7: 物理削除は禁止)。
 * `deletedAt`・操作者 `deletedBy`・理由 `deletedReason` を記録する (100 年運用の追跡性)。
 * `returnTo` で遷移先を切り替える (/kakochou からの除外にも対応)。
 */
export async function softDeleteDeathLedgerEntryAction(
  formData: FormData,
): Promise<void> {
  const entryId = readField(formData, 'entryId');
  if (entryId.length === 0) {
    throw new Error('entryId is required.');
  }
  assertValidUuid(entryId, 'deathLedgerEntryId');
  const reason = readField(formData, 'deletedReason');
  const returnTo = readField(formData, 'returnTo');

  const user = await requireCapability('softDelete');
  const tenantId = user.tenantId;

  const householdId = await withTenant(tenantId, async (tx) => {
    const entry = await tx.deathLedgerEntry.findUnique({
      where: { id: entryId },
      select: { deletedAt: true, person: { select: { householdId: true } } },
    });
    if (!entry) {
      throw new Error('対象の過去帳エントリが見つかりませんでした。');
    }
    if (entry.deletedAt !== null) {
      return entry.person.householdId; // 冪等
    }

    await tx.deathLedgerEntry.update({
      where: { id: entryId },
      data: {
        deletedAt: new Date(),
        deletedBy: user.id,
        deletedReason: nullIfBlank(reason),
      },
    });

    await recordAudit(tx, tenantId, {
      actorId: user.id,
      action: 'DELETE',
      entityType: 'DeathLedgerEntry',
      entityId: entryId,
      summary: `過去帳エントリを除外 (論理削除, 理由${nullIfBlank(reason) ? 'あり' : 'なし'})`,
    });

    return entry.person.householdId;
  });

  revalidatePath(`/danshintoto/${householdId}`);
  revalidatePath('/kakochou');
  revalidatePath('/kakochou/jogai');
  redirect(returnTo === 'kakochou' ? '/kakochou/jogai' : `/danshintoto/${householdId}`);
}

/**
 * 論理削除の取り消し (復元)。`deletedAt`・`deletedBy`・`deletedReason` をクリアする。
 * 物理削除した記録は存在しないため、除外済みのものは必ず復元できる。
 */
export async function restoreDeathLedgerEntryAction(
  formData: FormData,
): Promise<void> {
  const entryId = readField(formData, 'entryId');
  if (entryId.length === 0) {
    throw new Error('entryId is required.');
  }
  assertValidUuid(entryId, 'deathLedgerEntryId');

  const user = await requireCapability('softDelete');
  const tenantId = user.tenantId;

  await withTenant(tenantId, async (tx) => {
    const entry = await tx.deathLedgerEntry.findUnique({
      where: { id: entryId },
      select: { deletedAt: true },
    });
    if (!entry) {
      throw new Error('対象の過去帳エントリが見つかりませんでした。');
    }
    if (entry.deletedAt === null) {
      return; // 既に有効。冪等に成功扱い
    }
    await tx.deathLedgerEntry.update({
      where: { id: entryId },
      data: { deletedAt: null, deletedBy: null, deletedReason: null },
    });

    await recordAudit(tx, tenantId, {
      actorId: user.id,
      action: 'OTHER',
      entityType: 'DeathLedgerEntry',
      entityId: entryId,
      summary: '過去帳エントリを復元',
    });
  });

  revalidatePath('/kakochou');
  revalidatePath('/kakochou/jogai');
  redirect('/kakochou');
}
