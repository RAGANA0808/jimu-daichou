export type ImportableEvent = {
  googleEventId: string;
  title: string;
  startAtISO: string; // Date を ISO 文字列化 (Server→Client 受け渡し用)
  endAtISO: string | null;
  location: string | null;
  isAllDay: boolean;
  alreadyLinked: boolean; // 既に台帳に取込済み (法要 or 寺行事)
  linkedLabel: string | null; // '法要' | '寺行事' | null
};

export type CalendarImportState = {
  status: 'idle' | 'error' | 'success';
  importedCount?: number;
  formError?: string;
};

export const initialCalendarImportState: CalendarImportState = {
  status: 'idle',
};
