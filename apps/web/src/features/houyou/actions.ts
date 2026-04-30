'use server';

import type { PreparationStatus } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireCurrentTenantId } from '@/lib/auth';
import { assertValidUuid, withTenant } from '@/lib/db';
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
    endAt: new Date(src.scheduledAt.getTime() + 60 * 60 * 1000), // デフォルト 1 時間
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

  const tenantId = await requireCurrentTenantId();

  const { serviceId, refreshToken, householderName } = await withTenant(
    tenantId,
    async (tx) => {
      const service = await tx.memorialService.create({
        data: {
          tenantId,
          householdId,
          serviceName: values.serviceName,
          scheduledAt: parsedScheduledAt.date,
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
      return {
        serviceId: service.id,
        refreshToken: tenant?.googleRefreshToken ?? null,
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

  const tenantId = await requireCurrentTenantId();

  const { householdId, existingEventId, refreshToken, householderName } =
    await withTenant(tenantId, async (tx) => {
      const existing = await tx.memorialService.findUnique({
        where: { id },
        select: { householdId: true, googleCalendarEventId: true },
      });
      if (!existing) {
        throw new Error('対象の法要が見つかりませんでした。');
      }
      await tx.memorialService.update({
        where: { id },
        data: {
          serviceName: values.serviceName,
          scheduledAt: parsedScheduledAt.date,
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
      return {
        householdId: existing.householdId,
        existingEventId: existing.googleCalendarEventId,
        refreshToken: tenant?.googleRefreshToken ?? null,
        householderName: household?.householderName ?? '',
      };
    });

  await syncToCalendar(
    tenantId,
    id,
    refreshToken,
    existingEventId,
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
      },
      id,
    ),
  );

  revalidatePath('/houyou');
  revalidatePath(`/houyou/${id}`);
  revalidatePath(`/danshintoto/${householdId}`);
  redirect(`/houyou/${id}`);
}
