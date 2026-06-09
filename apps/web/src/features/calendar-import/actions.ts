'use server';

import { revalidatePath } from 'next/cache';
import { requireCapability } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { withTenant } from '@/lib/db';
import { decryptSecret } from '@/lib/crypto';
import { listCalendarEvents } from '@/lib/google/calendar';
import type { CalendarImportState } from './types';

const DEFAULT_MONTHS = 12;

/**
 * 選択された Google カレンダー予定を寺行事 (TempleEvent) として取り込む。
 * - クライアント送信値は ID リストのみ信用し、内容は Google から再取得して採用する。
 * - 既に取込済み (TempleEvent/MemorialService に同 googleCalendarEventId) は二重作成しない。
 * - 完全自動同期ではない手動トリガ (特許回避)。
 */
export async function importCalendarEventsAction(
  _prev: CalendarImportState,
  formData: FormData,
): Promise<CalendarImportState> {
  const user = await requireCapability('create');
  const tenantId = user.tenantId;

  // 1. 選択 ID を回収 (重複排除)
  const selectedIds = Array.from(
    new Set(
      formData
        .getAll('googleEventIds')
        .filter((v): v is string => typeof v === 'string' && v.length > 0),
    ),
  );
  if (selectedIds.length === 0) {
    return {
      status: 'error',
      formError: '取り込む予定を 1 件以上お選びください。',
    };
  }

  // 2. refresh_token を取得・復号
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
    return {
      status: 'error',
      formError:
        'Google カレンダーとの連携が確認できませんでした。設定をご確認ください。',
    };
  }

  // 3. Google から再取得 (クライアント送信内容は信用しない)
  const range = buildRange(DEFAULT_MONTHS);
  let fetched;
  try {
    fetched = await listCalendarEvents(refreshToken, {
      timeMinISO: range.timeMinISO,
      timeMaxISO: range.timeMaxISO,
    });
  } catch {
    return {
      status: 'error',
      formError:
        'Google カレンダーの読み込みに失敗しました。時間をおいてお試しください。',
    };
  }

  // 4. 選択 ID のうち、再取得結果に存在するものだけ採用
  const selectedSet = new Set(selectedIds);
  const toImport = fetched.filter((ev) => selectedSet.has(ev.googleEventId));
  if (toImport.length === 0) {
    return {
      status: 'error',
      formError:
        'お選びの予定が見つかりませんでした。画面を更新して再度お試しください。',
    };
  }

  // 5. withTenant 内で既存突合しつつ TempleEvent を作成 + 監査
  const importedCount = await withTenant(tenantId, async (tx) => {
    // 既存取込済み ID
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
    const existing = new Set<string>();
    for (const e of templeEvents) {
      if (e.googleCalendarEventId) existing.add(e.googleCalendarEventId);
    }
    for (const s of services) {
      if (s.googleCalendarEventId) existing.add(s.googleCalendarEventId);
    }

    let count = 0;
    for (const ev of toImport) {
      if (existing.has(ev.googleEventId)) continue; // 二重作成防止
      await tx.templeEvent.create({
        data: {
          tenantId,
          title: ev.title,
          scheduledAt: ev.startAt,
          // 終日は終了未設定 (null)。時刻付きは end.dateTime を採用。
          endTime: ev.isAllDay ? null : ev.endAt,
          location: ev.location,
          googleCalendarEventId: ev.googleEventId,
        },
        select: { id: true },
      });
      existing.add(ev.googleEventId); // 同一バッチ内の重複も防ぐ
      count += 1;
    }

    if (count > 0) {
      await recordAudit(tx, tenantId, {
        actorId: user.id,
        action: 'CREATE',
        entityType: 'TempleEvent',
        // 個人情報・タイトルは載せない。件数のみ。
        summary: `Google カレンダーから${count}件取込`,
      });
    }
    return count;
  });

  revalidatePath('/houyou');
  revalidatePath('/houyou/torikomi');

  if (importedCount === 0) {
    return {
      status: 'error',
      formError: 'お選びの予定はすべて取込済みでした。',
    };
  }
  return { status: 'success', importedCount };
}

function buildRange(months: number): {
  timeMinISO: string;
  timeMaxISO: string;
} {
  // 取込実行時の再取得は、表示時 (queries 側) に見えていた予定を確実に含むよう
  // 表示レンジ [now, now+months] のスーパーセット [now-1ヶ月, now+months+1ヶ月] にする。
  // 採用は選択 ID との一致で行うため、下限/上限を広げても取込対象は増えない。
  // これにより「表示→送信の時間差で直近予定が timeMin から外れて見つからない」誤判定を防ぐ。
  const now = new Date();
  const min = new Date(now);
  min.setMonth(min.getMonth() - 1);
  const max = new Date(now);
  max.setMonth(max.getMonth() + months + 1);
  return { timeMinISO: min.toISOString(), timeMaxISO: max.toISOString() };
}
