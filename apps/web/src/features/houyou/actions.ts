'use server';

import type { PreparationStatus } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireCapability } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { decryptSecret } from '@/lib/crypto';
import {
  assertNotStale,
  assertValidUuid,
  isStaleError,
  withTenant,
} from '@/lib/db';
import {
  createCalendarEvent,
  deleteCalendarEvent,
  updateCalendarEvent,
  type CalendarEventData,
} from '@/lib/google/calendar';
import type {
  MemorialServiceFieldName,
  MemorialServiceFormState,
} from './types';
import { PREPARATION_STATUS_ORDER } from './types';

function readField(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === 'string' ? v.trim() : '';
}

function nullIfBlank(value: string): string | null {
  return value.length === 0 ? null : value;
}

type MemorialServiceValues = Record<MemorialServiceFieldName, string>;

function extractValues(formData: FormData): MemorialServiceValues {
  return {
    serviceName: readField(formData, 'serviceName'),
    scheduledAt: readField(formData, 'scheduledAt'),
    endTime: readField(formData, 'endTime'),
    location: readField(formData, 'location'),
    attendeeCount: readField(formData, 'attendeeCount'),
    tobaCount: readField(formData, 'tobaCount'),
    offeringAmount: readField(formData, 'offeringAmount'),
    preparationStatus: readField(formData, 'preparationStatus'),
    memo: readField(formData, 'memo'),
  };
}

type ParsedScheduledAt = { date: Date };

function parseScheduledAt(raw: string): ParsedScheduledAt | null {
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
  return { date };
}

function parseIntegerInRange(
  raw: string,
  min: number,
  max: number,
): number | null {
  const n = Number.parseInt(raw, 10);
  if (
    Number.isNaN(n) ||
    !Number.isFinite(n) ||
    String(n) !== raw ||
    n < min ||
    n > max
  ) {
    return null;
  }
  return n;
}

function validate(values: MemorialServiceValues): {
  errors: NonNullable<MemorialServiceFormState['errors']>;
  parsedScheduledAt: ParsedScheduledAt | null;
  endTime: Date | null;
  attendeeCount: number | null;
  tobaCount: number | null;
  offeringAmount: number | null;
  preparationStatus: PreparationStatus;
} {
  const errors: NonNullable<MemorialServiceFormState['errors']> = {};

  if (values.serviceName.length === 0) {
    errors.serviceName = '法要名をご入力ください。';
  } else if (values.serviceName.length > 60) {
    errors.serviceName = '60 文字以内でご入力ください。';
  }

  let parsedScheduledAt: ParsedScheduledAt | null = null;
  if (values.scheduledAt.length === 0) {
    errors.scheduledAt = '予定日時をご入力ください。';
  } else {
    parsedScheduledAt = parseScheduledAt(values.scheduledAt);
    if (parsedScheduledAt === null) {
      errors.scheduledAt = '日時の形式が正しくありません。';
    }
  }

  // 終了予定時刻 (N-6)。任意。形式は scheduledAt と同じ datetime-local。
  let endTime: Date | null = null;
  if (values.endTime.length > 0) {
    const parsedEnd = parseScheduledAt(values.endTime);
    if (parsedEnd === null) {
      errors.endTime = '日時の形式が正しくありません。';
    } else if (
      parsedScheduledAt !== null &&
      parsedEnd.date.getTime() <= parsedScheduledAt.date.getTime()
    ) {
      errors.endTime = '終了時刻は開始時刻より後にしてください。';
    } else {
      endTime = parsedEnd.date;
    }
  }

  let attendeeCount: number | null = null;
  if (values.attendeeCount.length > 0) {
    const n = parseIntegerInRange(values.attendeeCount, 0, 1000);
    if (n === null) {
      errors.attendeeCount = '参列人数は 0 〜 1000 の整数でご入力ください。';
    } else {
      attendeeCount = n;
    }
  }

  let tobaCount: number | null = null;
  if (values.tobaCount.length > 0) {
    const n = parseIntegerInRange(values.tobaCount, 0, 1000);
    if (n === null) {
      errors.tobaCount = '塔婆本数は 0 〜 1000 の整数でご入力ください。';
    } else {
      tobaCount = n;
    }
  }

  let offeringAmount: number | null = null;
  if (values.offeringAmount.length > 0) {
    const n = parseIntegerInRange(values.offeringAmount, 0, 10_000_000);
    if (n === null) {
      errors.offeringAmount = '御布施額は 0 〜 10,000,000 の整数でご入力ください。';
    } else {
      offeringAmount = n;
    }
  }

  const statusRaw = values.preparationStatus;
  let preparationStatus: PreparationStatus = 'TENTATIVE';
  if (statusRaw.length > 0) {
    if ((PREPARATION_STATUS_ORDER as string[]).includes(statusRaw)) {
      preparationStatus = statusRaw as PreparationStatus;
    } else {
      errors.preparationStatus = '準備状況の値が不正です。';
    }
  }

  return {
    errors,
    parsedScheduledAt,
    endTime,
    attendeeCount,
    tobaCount,
    offeringAmount,
    preparationStatus,
  };
}

type EventSourceData = {
  serviceName: string;
  householderName: string;
  location: string | null;
  memo: string | null;
  attendeeCount: number | null;
  tobaCount: number | null;
  offeringAmount: number | null;
  scheduledAt: Date;
  endTime: Date | null;
};

function getDetailUrl(serviceId: string): string | null {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) return null;
  return `${appUrl.replace(/\/$/, '')}/houyou/${serviceId}`;
}

function buildCalendarEventData(
  src: EventSourceData,
  serviceId: string,
): CalendarEventData {
  const detailUrl = getDetailUrl(serviceId);

  const lines: string[] = [`世帯: ${src.householderName}`];
  if (src.attendeeCount !== null) lines.push(`参列人数: ${src.attendeeCount}`);
  if (src.tobaCount !== null) lines.push(`塔婆本数: ${src.tobaCount}`);
  if (src.offeringAmount !== null) {
    lines.push(`御布施額: ${src.offeringAmount.toLocaleString('ja-JP')} 円`);
  }
  if (src.memo !== null && src.memo.length > 0) {
    lines.push('', src.memo);
  }
  if (detailUrl) {
    lines.push('', '寺務台帳で詳細を開く:', detailUrl);
  }

  return {
    title: `法要: ${src.serviceName}`,
    description: lines.join('\n'),
    location: src.location,
    startAt: src.scheduledAt,
    // 終了時刻があれば採用、無ければ従来どおり既定 1 時間継続 (N-6)。
    endAt: src.endTime ?? new Date(src.scheduledAt.getTime() + 60 * 60 * 1000),
    detailUrl,
  };
}

/**
 * 指定法要について Google Calendar と同期する (best-effort)。
 * API エラーは握り潰して DB 側の成功は維持する。
 */
async function syncToCalendar(
  tenantId: string,
  serviceId: string,
  refreshToken: string | null,
  existingEventId: string | null,
  status: PreparationStatus,
  eventData: CalendarEventData,
): Promise<void> {
  if (!refreshToken) return;

  try {
    if (status === 'CANCELED') {
      // 中止 → イベント削除 + ID クリア
      if (existingEventId) {
        await deleteCalendarEvent(refreshToken, existingEventId);
        await withTenant(tenantId, (tx) =>
          tx.memorialService.update({
            where: { id: serviceId },
            data: { googleCalendarEventId: null },
          }),
        );
      }
      return;
    }

    if (existingEventId) {
      await updateCalendarEvent(refreshToken, existingEventId, eventData);
    } else {
      const newEventId = await createCalendarEvent(refreshToken, eventData);
      if (newEventId) {
        await withTenant(tenantId, (tx) =>
          tx.memorialService.update({
            where: { id: serviceId },
            data: { googleCalendarEventId: newEventId },
          }),
        );
      }
    }
  } catch {
    // best-effort。ログアウト済み / トークン失効 / ネットワーク障害等でも DB 側は成功維持。
  }
}

/**
 * 法要の新規登録 + (連携済みなら) Google Calendar への書込。
 */
export async function createMemorialServiceAction(
  _prev: MemorialServiceFormState,
  formData: FormData,
): Promise<MemorialServiceFormState> {
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
  const v = validate(values);
  const parsedScheduledAt = v.parsedScheduledAt;
  if (Object.keys(v.errors).length > 0 || parsedScheduledAt === null) {
    return { status: 'error', errors: v.errors, values };
  }

  const user = await requireCapability('create');
  const tenantId = user.tenantId;

  const { serviceId, refreshToken, householderName } = await withTenant(
    tenantId,
    async (tx) => {
      const service = await tx.memorialService.create({
        data: {
          tenantId,
          householdId,
          serviceName: values.serviceName,
          scheduledAt: parsedScheduledAt.date,
          endTime: v.endTime,
          location: nullIfBlank(values.location),
          attendeeCount: v.attendeeCount,
          tobaCount: v.tobaCount,
          offeringAmount: v.offeringAmount,
          preparationStatus: v.preparationStatus,
          memo: nullIfBlank(values.memo),
        },
        select: { id: true },
      });
      const [tenant, household] = await Promise.all([
        tx.tenant.findUnique({
          where: { id: tenantId },
          select: { googleRefreshToken: true },
        }),
        tx.household.findUnique({
          where: { id: householdId },
          select: { householderName: true },
        }),
      ]);
      await recordAudit(tx, tenantId, {
        actorId: user.id,
        action: 'CREATE',
        entityType: 'MemorialService',
        entityId: service.id,
        summary: '法要を新規登録',
      });
      return {
        serviceId: service.id,
        // P-6: 保存値は暗号化されている可能性があるため復号して使う (平文は素通し)。
        refreshToken: tenant?.googleRefreshToken
          ? decryptSecret(tenant.googleRefreshToken) || null
          : null,
        householderName: household?.householderName ?? '',
      };
    },
  );

  await syncToCalendar(
    tenantId,
    serviceId,
    refreshToken,
    null,
    v.preparationStatus,
    buildCalendarEventData(
      {
        serviceName: values.serviceName,
        householderName,
        location: nullIfBlank(values.location),
        memo: nullIfBlank(values.memo),
        attendeeCount: v.attendeeCount,
        tobaCount: v.tobaCount,
        offeringAmount: v.offeringAmount,
        scheduledAt: parsedScheduledAt.date,
        endTime: v.endTime,
      },
      serviceId,
    ),
  );

  revalidatePath('/houyou');
  revalidatePath(`/danshintoto/${householdId}`);
  redirect(`/houyou/${serviceId}`);
}

/**
 * 法要の編集 + Google Calendar 同期 (既存 eventId に合わせて create/update/delete を切替)。
 */
export async function updateMemorialServiceAction(
  _prev: MemorialServiceFormState,
  formData: FormData,
): Promise<MemorialServiceFormState> {
  const id = readField(formData, 'memorialServiceId');
  if (id.length === 0) {
    return {
      status: 'error',
      errors: {},
      values: extractValues(formData),
    };
  }
  assertValidUuid(id, 'memorialServiceId');

  const values = extractValues(formData);
  const v = validate(values);
  const parsedScheduledAt = v.parsedScheduledAt;
  if (Object.keys(v.errors).length > 0 || parsedScheduledAt === null) {
    return { status: 'error', errors: v.errors, values };
  }

  // M-5: 楽観ロックトークン (epoch ms 文字列)。空なら検証をスキップ (後方互換)。
  const expectedUpdatedAt = readField(formData, 'expectedUpdatedAt');

  const user = await requireCapability('update');
  const tenantId = user.tenantId;

  let updated: {
    householdId: string;
    existingEventId: string | null;
    refreshToken: string | null;
    householderName: string;
  };
  try {
    updated = await withTenant(tenantId, async (tx) => {
      const existing = await tx.memorialService.findUnique({
        where: { id },
        select: {
          householdId: true,
          googleCalendarEventId: true,
          updatedAt: true,
        },
      });
      if (!existing) {
        throw new Error('対象の法要が見つかりませんでした。');
      }
      if (expectedUpdatedAt.length > 0) {
        assertNotStale(expectedUpdatedAt, existing.updatedAt);
      }
      await tx.memorialService.update({
        where: { id },
        data: {
          serviceName: values.serviceName,
          scheduledAt: parsedScheduledAt.date,
          endTime: v.endTime,
          location: nullIfBlank(values.location),
          attendeeCount: v.attendeeCount,
          tobaCount: v.tobaCount,
          offeringAmount: v.offeringAmount,
          preparationStatus: v.preparationStatus,
          memo: nullIfBlank(values.memo),
        },
      });
      const [tenant, household] = await Promise.all([
        tx.tenant.findUnique({
          where: { id: tenantId },
          select: { googleRefreshToken: true },
        }),
        tx.household.findUnique({
          where: { id: existing.householdId },
          select: { householderName: true },
        }),
      ]);
      await recordAudit(tx, tenantId, {
        actorId: user.id,
        action: 'UPDATE',
        entityType: 'MemorialService',
        entityId: id,
        summary: '法要を編集',
      });
      return {
        householdId: existing.householdId,
        existingEventId: existing.googleCalendarEventId,
        // P-6: 保存値は暗号化されている可能性があるため復号して使う (平文は素通し)。
        refreshToken: tenant?.googleRefreshToken
          ? decryptSecret(tenant.googleRefreshToken) || null
          : null,
        householderName: household?.householderName ?? '',
      };
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

  await syncToCalendar(
    tenantId,
    id,
    updated.refreshToken,
    updated.existingEventId,
    v.preparationStatus,
    buildCalendarEventData(
      {
        serviceName: values.serviceName,
        householderName: updated.householderName,
        location: nullIfBlank(values.location),
        memo: nullIfBlank(values.memo),
        attendeeCount: v.attendeeCount,
        tobaCount: v.tobaCount,
        offeringAmount: v.offeringAmount,
        scheduledAt: parsedScheduledAt.date,
        endTime: v.endTime,
      },
      id,
    ),
  );

  revalidatePath('/houyou');
  revalidatePath(`/houyou/${id}`);
  revalidatePath(`/danshintoto/${updated.householdId}`);
  redirect(`/houyou/${id}`);
}
