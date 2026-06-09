'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { normalizeTagColor, TAG_COLOR_CHIP_CLASS } from './tag-colors';
import type { TagItem } from './HouseholdTagEditor';

type Props = {
  /** テナント内の全タグ。 */
  allTags: TagItem[];
  /** 現在 URL で選択中のタグ id。 */
  selectedTagIds: string[];
  /** 現在の絞り込みモード。 */
  mode: 'and' | 'or';
};

export function HouseholdTagFilter({ allTags, selectedTagIds, mode }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(selectedTagIds),
  );
  const [currentMode, setCurrentMode] = useState<'and' | 'or'>(mode);

  if (allTags.length === 0) {
    return null;
  }

  function toggle(tagId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
      return next;
    });
  }

  function apply(nextSelected: Set<string>, nextMode: 'and' | 'or') {
    const ids = [...nextSelected];
    if (ids.length === 0) {
      router.push('/danshintoto');
      return;
    }
    const params = new URLSearchParams();
    params.set('tags', ids.join(','));
    params.set('mode', nextMode);
    router.push(`/danshintoto?${params.toString()}`);
  }

  function clearAll() {
    setSelected(new Set());
    router.push('/danshintoto');
  }

  const hasSelection = selected.size > 0;

  return (
    <div className="rounded border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-foreground">タグで絞り込む</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">複数選択時:</span>
          <div className="inline-flex overflow-hidden rounded border border-border text-xs">
            <button
              type="button"
              aria-pressed={currentMode === 'or'}
              onClick={() => setCurrentMode('or')}
              className={cn(
                'px-3 py-1 transition-colors',
                currentMode === 'or'
                  ? 'bg-brand text-brand-foreground'
                  : 'bg-surface text-muted-foreground hover:bg-muted',
              )}
            >
              いずれか
            </button>
            <button
              type="button"
              aria-pressed={currentMode === 'and'}
              onClick={() => setCurrentMode('and')}
              className={cn(
                'border-l border-border px-3 py-1 transition-colors',
                currentMode === 'and'
                  ? 'bg-brand text-brand-foreground'
                  : 'bg-surface text-muted-foreground hover:bg-muted',
              )}
            >
              すべて
            </button>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {allTags.map((t) => {
          const isSel = selected.has(t.id);
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={isSel}
              onClick={() => toggle(t.id)}
              className={cn(
                'inline-flex items-center rounded-full border px-3 py-1 text-sm transition-colors',
                isSel
                  ? 'ring-2 ring-primary ring-offset-1'
                  : 'hover:brightness-95',
                TAG_COLOR_CHIP_CLASS[normalizeTagColor(t.color)],
              )}
            >
              {t.name}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => apply(selected, currentMode)}
          className="inline-flex min-h-touch items-center rounded bg-brand px-4 py-1.5 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-hover"
        >
          絞り込む
        </button>
        {hasSelection && (
          <button
            type="button"
            onClick={clearAll}
            className="rounded border border-border px-4 py-1.5 text-sm text-foreground hover:bg-muted"
          >
            解除
          </button>
        )}
      </div>
    </div>
  );
}
