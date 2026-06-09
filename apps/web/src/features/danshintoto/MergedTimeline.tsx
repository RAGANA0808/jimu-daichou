import { Badge } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { MergedTimelineItem } from './merged-timeline-queries';

type Props = {
  items: MergedTimelineItem[];
};

function formatJstDateTime(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const week = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
  return `${y}/${m}/${day}（${week}）${hh}:${mm}`;
}

/**
 * 対応履歴と法要をマージした閲覧専用タイムライン。
 * 編集・ピン・除外などの操作は持たない (概観目的)。
 */
export function MergedTimeline({ items }: Props) {
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-surface px-4 py-8 text-center text-base text-muted-foreground">
        まだ年表に表示できる記録はありません。
      </p>
    );
  }

  return (
    <ol className="relative space-y-4 border-l-2 border-border pl-5">
      {items.map((item) => (
        <li key={`${item.type}:${item.id}`} className="relative">
          <span
            aria-hidden="true"
            className={cn(
              'absolute -left-[1.6rem] top-1.5 h-3 w-3 rounded-full border-2 border-surface',
              item.type === 'memorial' ? 'bg-success' : 'bg-info',
            )}
          />
          <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={item.type === 'memorial' ? 'success' : 'info'}>
                {item.badge}
              </Badge>
              {item.category && (
                <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-sm text-muted-foreground">
                  {item.category}
                </span>
              )}
              <time className="text-base font-medium text-foreground">
                {formatJstDateTime(item.occurredAt)}
              </time>
            </div>
            <p className="mt-2 text-base text-foreground">{item.title}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
