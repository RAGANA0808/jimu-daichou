import 'server-only';
import { google } from 'googleapis';
import { googleAuthConfig } from './env';

export type CalendarEventData = {
  title: string;
  description: string;
  location: string | null;
  startAt: Date;
  endAt: Date;
  /** Calendar event source (UI 上で「寺務台帳で開く」リンクになる) */
  detailUrl: string | null;
};

const CALENDAR_ID = 'primary';
const TIME_ZONE = 'Asia/Tokyo';

/**
 * refresh_token を使って OAuth2 クライアントを作り、access_token を内部で自動更新させる。
 */
function buildAuthClient(refreshToken: string) {
  const oauth = new google.auth.OAuth2(
    googleAuthConfig.clientId(),
    googleAuthConfig.clientSecret(),
    googleAuthConfig.redirectUri(),
  );
  oauth.setCredentials({ refresh_token: refreshToken });
  return oauth;
}

function buildEventBody(data: CalendarEventData) {
  return {
    summary: data.title,
    description: data.description,
    location: data.location ?? undefined,
    start: { dateTime: data.startAt.toISOString(), timeZone: TIME_ZONE },
    end: { dateTime: data.endAt.toISOString(), timeZone: TIME_ZONE },
    source: data.detailUrl
      ? { title: '寺務台帳', url: data.detailUrl }
      : undefined,
  };
}

/**
 * 法要を Google Calendar に新規作成する。成功時は event.id を返す。
 */
export async function createCalendarEvent(
  refreshToken: string,
  data: CalendarEventData,
): Promise<string | null> {
  const calendar = google.calendar({ version: 'v3', auth: buildAuthClient(refreshToken) });
  const response = await calendar.events.insert({
    calendarId: CALENDAR_ID,
    requestBody: buildEventBody(data),
  });
  return response.data.id ?? null;
}

/**
 * 既存イベントを更新する。
 */
export async function updateCalendarEvent(
  refreshToken: string,
  eventId: string,
  data: CalendarEventData,
): Promise<void> {
  const calendar = google.calendar({ version: 'v3', auth: buildAuthClient(refreshToken) });
  await calendar.events.update({
    calendarId: CALENDAR_ID,
    eventId,
    requestBody: buildEventBody(data),
  });
}

/**
 * イベント削除。既に存在しなくてもエラー扱いしない (冪等)。
 */
export async function deleteCalendarEvent(
  refreshToken: string,
  eventId: string,
): Promise<void> {
  const calendar = google.calendar({ version: 'v3', auth: buildAuthClient(refreshToken) });
  try {
    await calendar.events.delete({
      calendarId: CALENDAR_ID,
      eventId,
    });
  } catch (err: unknown) {
    // 既に削除されている場合 (410 Gone) は冪等に成功扱い
    const status =
      err && typeof err === 'object' && 'code' in err
        ? (err as { code?: number }).code
        : undefined;
    if (status === 410 || status === 404) {
      return;
    }
    throw err;
  }
}
