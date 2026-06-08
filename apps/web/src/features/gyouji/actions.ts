'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireCapability } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { decryptSecret } from '@/lib/crypto';
import { assertValidUuid, withTenant } from '@/lib/db';
import {
  createCalendarEvent,
  deleteCalendarEvent,
  updateCalendarEvent,
  type CalendarEventData,
} from '@/lib/google/calendar';
import type { TempleEventFieldName, TempleEventFormState } from './types';

function readField(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === 'string' ? v.trim() : '';
}

function nullIfBlank(value: string): string | null {
  return value.length === 0 ? null : value;
}

type TempleEventValues = Record<TempleEventFieldName, string>;

function extractValues(formData: FormData): TempleEventValues {
  return {
    title: readField(formData, 'title'),
    scheduledAt: readField(formData, 'scheduledAt'),
    endTime: readField(formData, 'endTime'),
    location: readField(formData, 'location'),
    memo: readField(formData, 'memo'),
  };
}

type ParsedScheduledAt = { date: Date };

// houyou/actions.ts の parseScheduledAt を踏襲 (datetime-local を JST の Date として解釈)。
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

function validate(values: TempleEventValues): {
  errors: NonNullable<TempleEventFormState['errors']>;
  parsedScheduledAt: ParsedScheduledAt | null;
  endTime: Date | null;
} {
  const errors: NonNullable<TempleEventFormState['errors']> = {};

  if (values.title.length === 0) {
    errors.title = '行事名をご入力ください。';
  } else if (values.title.length > 60) {
    errors.title = '60 文字以内でご入力ください。';
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

  if (values.location.length > 120) {
    errors.location = '120 文字以内でご入力ください。';
  }
  if (values.memo.length > 2000) {
    errors.memo = '2000 文字以内でご入力ください。';
  }

  return { errors, parsedScheduledAt, endTime };
}

type TempleEventSourceData = {
  title: string;
  location: string | null;
  memo: string | null;
  scheduledAt: Date;
  endTime: Date | null;
};

function getDetailUrl(eventId: string): string | null {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) return null;
  // 専用詳細ページは作らないため編集ページを指す。
  return `${appUrl.replace(/\/$/, '')}/houyou/gyouji/${eventId}/edit`;
}

function buildTempleEventCalendarData(
  src: TempleEventSourceData,
  eventId: string,
): CalendarEventData {
  const detailUrl = getDetailUrl(eventId);

  const lines: string[] = [];
  if (src.memo !== null && src.memo.length > 0) {
    lines.push(src.memo);
  }
  if (detailUrl) {
    lines.push('', '寺務台帳で詳細を開く:', detailUrl);
  }

  return {
    // 法要 (「法要: 」) と区別するため接頭は「行事: 」。
    title: `行事: ${src.title}`,
    description: lines.join('\n'),
    location: src.location,
    startAt: src.scheduledAt,
    endAt: src.endTime ?? new Date(src.scheduledAt.getTime() + 60 * 60 * 1000),
    detailUrl,
  };
}

/**
 * 指定の寺行事について Google Calendar と同期する (best-effort)。
 * API エラーは握り潰して DB 側の成功は維持する。
 */
async function syncToCalendar(
  tenantId: string,
  eventId: string,
  refreshToken: string | null,
  existingEventId: string | null,
  eventData: CalendarEventData,
): Promise<void> {
  if (!refreshToken) return;

  try {
    if (existingEventId) {
      await updateCalendarEvent(refreshToken, existingEventId, eventData);
    } else {
      const newEventId = await createCalendarEvent(refreshToken, eventData);
      if (newEventId) {
        await withTenant(tenantId, (tx) =>
          tx.templeEvent.update({
            where: { id: eventId },
            data: { googleCalendarEventId: newEventId },
          }),
        );
      }
    }
  } catch {
    // best-effort。トークン失効・ネットワーク障害等でも DB 側の成功は維持する。
  }
}

/**
 * 寺行事の新規登録 + (連携済みなら) Google Calendar への書込。
 */
export async function createTempleEventAction(
  _prev: TempleEventFormState,
  formData: FormData,
): Promise<TempleEventFormState> {
  const values = extractValues(formData);
  const v = validate(values);
  const parsedScheduledAt = v.parsedScheduledAt;
  if (Object.keys(v.errors).length > 0 || parsedScheduledAt === null) {
    return { status: 'error', errors: v.errors, values };
  }

  const user = await requireCapability('create');
  const tenantId = user.tenantId;

  const { eventId, refreshToken } = await withTenant(tenantId, async (tx) => {
    const event = await tx.templeEvent.create({
      data: {
        tenantId,
        title: values.title,
        scheduledAt: parsedScheduledAt.date,
        endTime: v.endTime,
        location: nullIfBlank(values.location),
        memo: nullIfBlank(values.memo),
      },
      select: { id: true },
    });
    const tenant = await tx.tenant.findUnique({
      where: { id: tenantId },
      select: { googleRefreshToken: true },
    });
    await recordAudit(tx, tenantId, {
      actorId: user.id,
      action: 'CREATE',
      entityType: 'TempleEvent',
      entityId: event.id,
      summary: '寺行事を新規登録',
    });
    return {
      eventId: event.id,
      // P-6: 保存値は暗号化されている可能性があるため復号して使う (平文は素通し)。
      refreshToken: tenant?.googleRefreshToken
        ? decryptSecret(tenant.googleRefreshToken) || null
        : null,
    };
  });

  await syncToCalendar(
    tenantId,
    eventId,
    refreshToken,
    null,
    buildTempleEventCalendarData(
      {
        title: values.title,
        location: nullIfBlank(values.location),
        memo: nullIfBlank(values.memo),
        scheduledAt: parsedScheduledAt.date,
        endTime: v.endTime,
      },
      eventId,
    ),
  );

  revalidatePath('/houyou');
  redirect('/houyou');
}

/**
 * 寺行事の編集 + Google Calendar 同期 (既存 eventId に合わせて create/update を切替)。
 */
export async function updateTempleEventAction(
  _prev: TempleEventFormState,
  formData: FormData,
): Promise<TempleEventFormState> {
  const id = readField(formData, 'templeEventId');
  if (id.length === 0) {
    return { status: 'error', errors: {}, values: extractValues(formData) };
  }
  assertValidUuid(id, 'templeEventId');

  const values = extractValues(formData);
  const v = validate(values);
  const parsedScheduledAt = v.parsedScheduledAt;
  if (Object.keys(v.errors).length > 0 || parsedScheduledAt === null) {
    return { status: 'error', errors: v.errors, values };
  }

  const user = await requireCapability('update');
  const tenantId = user.tenantId;

  const { existingEventId, refreshToken } = await withTenant(
    tenantId,
    async (tx) => {
      const existing = await tx.templeEvent.findUnique({
        where: { id },
        select: { deletedAt: true, googleCalendarEventId: true },
      });
      if (!existing || existing.deletedAt !== null) {
        throw new Error('対象の行事が見つかりませんでした。');
      }
      await tx.templeEvent.update({
        where: { id },
        data: {
          title: values.title,
          scheduledAt: parsedScheduledAt.date,
          endTime: v.endTime,
          location: nullIfBlank(values.location),
          memo: nullIfBlank(values.memo),
        },
      });
      const tenant = await tx.tenant.findUnique({
        where: { id: tenantId },
        select: { googleRefreshToken: true },
      });
      await recordAudit(tx, tenantId, {
        actorId: user.id,
        action: 'UPDATE',
        entityType: 'TempleEvent',
        entityId: id,
        summary: '寺行事を編集',
      });
      return {
        existingEventId: existing.googleCalendarEventId,
        refreshToken: tenant?.googleRefreshToken
          ? decryptSecret(tenant.googleRefreshToken) || null
          : null,
      };
    },
  );

  await syncToCalendar(
    tenantId,
    id,
    refreshToken,
    existingEventId,
    buildTempleEventCalendarData(
      {
        title: values.title,
        location: nullIfBlank(values.location),
        memo: nullIfBlank(values.memo),
        scheduledAt: parsedScheduledAt.date,
        endTime: v.endTime,
      },
      id,
    ),
  );

  revalidatePath('/houyou');
  redirect('/houyou');
}

/**
 * 寺行事の論理削除 (除外)。物理削除はしない。
 * 既存の Calendar イベントがあれば best-effort で削除する。冪等。
 */
export async function softDeleteTempleEventAction(
  formData: FormData,
): Promise<void> {
  const id = readField(formData, 'templeEventId');
  if (id.length === 0) {
    throw new Error('templeEventId is required.');
  }
  assertValidUuid(id, 'templeEventId');
  const reason = readField(formData, 'deletedReason');

  const user = await requireCapability('softDelete');
  const tenantId = user.tenantId;

  const { existingEventId, refreshToken } = await withTenant(
    tenantId,
    async (tx) => {
      const existing = await tx.templeEvent.findUnique({
        where: { id },
        select: { deletedAt: true, googleCalendarEventId: true },
      });
      if (!existing) {
        throw new Error('対象の行事が見つかりませんでした。');
      }
      if (existing.deletedAt !== null) {
        return { existingEventId: null, refreshToken: null }; // 冪等
      }

      await tx.templeEvent.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          deletedBy: user.id,
          deletedReason: nullIfBlank(reason),
        },
      });

      const tenant = await tx.tenant.findUnique({
        where: { id: tenantId },
        select: { googleRefreshToken: true },
      });

      await recordAudit(tx, tenantId, {
        actorId: user.id,
        action: 'DELETE',
        entityType: 'TempleEvent',
        entityId: id,
        summary: '寺行事を除外 (論理削除)',
      });

      return {
        existingEventId: existing.googleCalendarEventId,
        refreshToken: tenant?.googleRefreshToken
          ? decryptSecret(tenant.googleRefreshToken) || null
          : null,
      };
    },
  );

  if (existingEventId && refreshToken) {
    try {
      await deleteCalendarEvent(refreshToken, existingEventId);
      await withTenant(tenantId, (tx) =>
        tx.templeEvent.update({
          where: { id },
          data: { googleCalendarEventId: null },
        }),
      );
    } catch {
      // best-effort。
    }
  }

  revalidatePath('/houyou');
  redirect('/houyou');
}
