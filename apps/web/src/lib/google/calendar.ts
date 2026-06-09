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

/**
 * Google Calendar から取込候補として正規化したイベント。
 * 時刻付き: startAt = dateTime, endAt = end.dateTime (Date)。
 * 終日:    isAllDay = true, startAt = start.date の 0:00, endAt = end.date の 0:00 (排他終端) または null。
 */
export type GoogleCalendarEvent = {
  googleEventId: string;
  title: string;
  startAt: Date;
  endAt: Date | null;
  location: string | null;
  description: string | null;
  isAllDay: boolean;
};

/**
 * primary カレンダーの予定を期間指定で取得し、取込候補に正規化する (読取専用)。
 * 完全自動同期はしない: 呼び出しは「取込画面の表示」「取込実行時の再取得」の手動トリガのみ。
 */
export async function listCalendarEvents(
  refreshToken: string,
  opts: { timeMinISO: string; timeMaxISO: string },
): Promise<GoogleCalendarEvent[]> {
  const calendar = google.calendar({
    version: 'v3',
    auth: buildAuthClient(refreshToken),
  });
  const response = await calendar.events.list({
    calendarId: CALENDAR_ID,
    timeMin: opts.timeMinISO,
    timeMax: opts.timeMaxISO,
    singleEvents: true, // 繰り返し予定を個別インスタンスに展開
    orderBy: 'startTime', // singleEvents:true のときのみ有効
    maxResults: 250,
  });

  const items = response.data.items ?? [];
  const result: GoogleCalendarEvent[] = [];

  for (const item of items) {
    const id = item.id;
    if (!id) continue; // id 無しは取込キーが作れないため除外

    const start = item.start;
    const end = item.end;

    // 終日イベント: start.date / end.date (YYYY-MM-DD)。dateTime は無い。
    if (start?.date) {
      const startAt = parseAllDayDate(start.date);
      if (startAt === null) continue;
      const endAt = end?.date ? parseAllDayDate(end.date) : null;
      result.push({
        googleEventId: id,
        title: item.summary ?? '(無題)',
        startAt,
        endAt, // Google の end.date は排他的翌日始点。表示用途のためそのまま保持。
        location: item.location ?? null,
        description: item.description ?? null,
        isAllDay: true,
      });
      continue;
    }

    // 時刻付きイベント: start.dateTime / end.dateTime (RFC3339, タイムゾーンオフセット付き)。
    if (start?.dateTime) {
      const startAt = new Date(start.dateTime);
      if (Number.isNaN(startAt.getTime())) continue;
      let endAt: Date | null = null;
      if (end?.dateTime) {
        const parsedEnd = new Date(end.dateTime);
        endAt = Number.isNaN(parsedEnd.getTime()) ? null : parsedEnd;
      }
      result.push({
        googleEventId: id,
        title: item.summary ?? '(無題)',
        startAt,
        endAt,
        location: item.location ?? null,
        description: item.description ?? null,
        isAllDay: false,
      });
      continue;
    }
    // start が無い (date も dateTime も無い) 異常データは除外。
  }

  return result;
}

/**
 * 終日イベントの "YYYY-MM-DD" を JST のその日 0:00 の Date にする。
 * サーバ TZ に依存しないよう、年月日を数値で組み立てる。
 * 注意: 本番/Vercel は TZ=Asia/Tokyo 前提 (CLAUDE.md §4.3)。new Date(y, m-1, d) はローカル TZ 0:00。
 */
function parseAllDayDate(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  const [, yStr, moStr, dStr] = m;
  if (
    yStr === undefined ||
    moStr === undefined ||
    dStr === undefined
  ) {
    return null;
  }
  const y = Number.parseInt(yStr, 10);
  const mo = Number.parseInt(moStr, 10);
  const d = Number.parseInt(dStr, 10);
  const date = new Date(y, mo - 1, d, 0, 0, 0, 0);
  if (
    date.getFullYear() !== y ||
    date.getMonth() + 1 !== mo ||
    date.getDate() !== d
  ) {
    return null;
  }
  return date;
}
