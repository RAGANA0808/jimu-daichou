'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { Badge, EmptyState } from '@/components/ui';
import { cn } from '@/lib/utils';
import { importCalendarEventsAction } from './actions';
import { initialCalendarImportState, type ImportableEvent } from './types';

/** JST 基準で予定の日時を整形する (houyou 一覧の formatJstDateTime/formatSchedule に揃える)。 */
function formatEventWhen(ev: ImportableEvent): string {
  const s = new Date(ev.startAtISO);
  const ymd = `${s.getFullYear()}/${s.getMonth() + 1}/${s.getDate()}`;
  if (ev.isAllDay) return `${ymd}（終日）`;
  const hhmm = `${String(s.getHours()).padStart(2, '0')}:${String(
    s.getMinutes(),
  ).padStart(2, '0')}`;
  if (!ev.endAtISO) return `${ymd} ${hhmm}`;
  const e = new Date(ev.endAtISO);
  const sameDay =
    s.getFullYear() === e.getFullYear() &&
    s.getMonth() === e.getMonth() &&
    s.getDate() === e.getDate();
  const eh = `${String(e.getHours()).padStart(2, '0')}:${String(
    e.getMinutes(),
  ).padStart(2, '0')}`;
  return sameDay ? `${ymd} ${hhmm} 〜 ${eh}` : `${ymd} ${hhmm}`;
}

export function CalendarImportForm({ events }: { events: ImportableEvent[] }) {
  const [state, formAction, isPending] = useActionState(
    importCalendarEventsAction,
    initialCalendarImportState,
  );
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === 'success') {
      setSelected(new Set());
      formRef.current?.reset();
    }
  }, [state]);

  const importableCount = events.filter((e) => !e.alreadyLinked).length;
  const selectedCount = selected.size;

  function handleToggle(e: React.ChangeEvent<HTMLInputElement>) {
    const id = e.target.value;
    const checked = e.target.checked;
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  if (events.length === 0) {
    return (
      <EmptyState
        title="表示できる予定がありません"
        description="期間内に Google カレンダーの予定が見つかりませんでした。"
      />
    );
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {state.status === 'success' && (
        <p
          role="status"
          className="rounded bg-green-50 px-3 py-2 text-sm text-green-800"
        >
          {state.importedCount} 件を寺の行事として取り込みました。
        </p>
      )}
      {state.formError && (
        <p
          role="alert"
          className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {state.formError}
        </p>
      )}

      {importableCount === 0 && (
        <p className="text-sm text-muted-foreground">
          取り込める新しい予定はありません。
        </p>
      )}

      <ul className="space-y-2">
        {events.map((ev) => (
          <li key={ev.googleEventId}>
            <label
              className={cn(
                'flex items-start gap-3 rounded border border-border p-3',
                ev.alreadyLinked
                  ? 'opacity-60'
                  : 'cursor-pointer hover:bg-muted',
              )}
            >
              <input
                type="checkbox"
                name="googleEventIds"
                value={ev.googleEventId}
                disabled={ev.alreadyLinked}
                onChange={handleToggle}
                className="mt-1 h-5 w-5 shrink-0 accent-brand"
              />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">
                    {ev.title || '(無題)'}
                  </span>
                  {ev.alreadyLinked && (
                    <Badge variant="neutral">
                      {ev.linkedLabel === '法要'
                        ? '取込済 (法要)'
                        : '取込済 (寺行事)'}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatEventWhen(ev)}
                </p>
                {ev.location && (
                  <p className="text-sm text-muted-foreground">
                    場所: {ev.location}
                  </p>
                )}
              </div>
            </label>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending || selectedCount === 0}
          className="inline-flex min-h-touch items-center rounded bg-brand px-4 py-2 font-medium text-brand-foreground transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? '取り込み中…' : '選択した予定を取り込む'}
        </button>
        <p className="text-sm text-muted-foreground">
          {selectedCount} 件を選択中
        </p>
      </div>
    </form>
  );
}
