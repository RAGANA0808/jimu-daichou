import 'server-only';
import { requireCapability, requireCurrentTenantId } from '@/lib/auth';
import { withTenant } from '@/lib/db';
import { decryptSecret } from '@/lib/crypto';
import {
  listCalendarEvents,
  type GoogleCalendarEvent,
} from '@/lib/google/calendar';
import type { ImportableEvent } from './types';

const DEFAULT_MONTHS = 12;

export type CalendarImportData = {
  connected: boolean;
  rangeLabel: string;
  events: ImportableEvent[];
};

/**
 * 取込画面の表示データを構築する (読取専用・手動トリガ)。
 * - 未連携 (refresh_token 無し/復号不可) は connected:false で即返す。
 * - 連携済みは [now, now+months] の primary 予定を取得し、既存 googleCalendarEventId と突合して
 *   alreadyLinked / linkedLabel を付与する。
 */
export async function getCalendarImportData(opts?: {
  months?: number;
}): Promise<CalendarImportData> {
  await requireCapability('read');
  const tenantId = await requireCurrentTenantId();
  const months = opts?.months ?? DEFAULT_MONTHS;

  // 1. refresh_token を取得・復号
  const refreshToken = await withTenant(tenantId, async (tx) => {
    const tenant = await tx.tenant.findUnique({
      where: { id: tenantId },
      select: { googleRefreshToken: true },
    });
    if (!tenant?.googleRefreshToken) return null;
    const decrypted = decryptSecret(tenant.googleRefreshToken);
    return decrypted.length > 0 ? decrypted : null;
  });

  if (!refreshToken) {
    return { connected: false, rangeLabel: '', events: [] };
  }

  // 2. Google から取得
  const range = buildRange(months);
  let raw: GoogleCalendarEvent[];
  try {
    raw = await listCalendarEvents(refreshToken, {
      timeMinISO: range.timeMinISO,
      timeMaxISO: range.timeMaxISO,
    });
  } catch {
    // トークン失効・API 障害。連携自体はある扱いだが一覧は空でエラー表示せず穏当に。
    return { connected: true, rangeLabel: range.label, events: [] };
  }

  // 3. 既存の取込済み ID 集合を作る (TempleEvent: deletedAt null / MemorialService)
  const linked = await withTenant(tenantId, async (tx) => {
    const [templeEvents, services] = await Promise.all([
      tx.templeEvent.findMany({
        where: { deletedAt: null, googleCalendarEventId: { not: null } },
        select: { googleCalendarEventId: true },
      }),
      tx.memorialService.findMany({
        where: { googleCalendarEventId: { not: null } },
        select: { googleCalendarEventId: true },
      }),
    ]);
    const templeSet = new Set(
      templeEvents
        .map((e) => e.googleCalendarEventId)
        .filter((v): v is string => v !== null),
    );
    const serviceSet = new Set(
      services
        .map((s) => s.googleCalendarEventId)
        .filter((v): v is string => v !== null),
    );
    return { templeSet, serviceSet };
  });

  // 4. ImportableEvent に正規化 (法要を優先ラベルにする)
  const events: ImportableEvent[] = raw.map((ev) => {
    const isService = linked.serviceSet.has(ev.googleEventId);
    const isTemple = linked.templeSet.has(ev.googleEventId);
    const alreadyLinked = isService || isTemple;
    const linkedLabel = isService ? '法要' : isTemple ? '寺行事' : null;
    return {
      googleEventId: ev.googleEventId,
      title: ev.title,
      startAtISO: ev.startAt.toISOString(),
      endAtISO: ev.endAt ? ev.endAt.toISOString() : null,
      location: ev.location,
      isAllDay: ev.isAllDay,
      alreadyLinked,
      linkedLabel,
    };
  });

  return { connected: true, rangeLabel: range.label, events };
}

function buildRange(months: number): {
  timeMinISO: string;
  timeMaxISO: string;
  label: string;
} {
  const now = new Date();
  const max = new Date(now);
  max.setMonth(max.getMonth() + months);
  const label = `${formatJaDate(now)} 〜 ${formatJaDate(max)}`;
  return {
    timeMinISO: now.toISOString(),
    timeMaxISO: max.toISOString(),
    label,
  };
}

function formatJaDate(d: Date): string {
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}
