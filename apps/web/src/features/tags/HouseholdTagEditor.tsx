'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { Button, FormField, Input } from '@/components/ui';
import { cn } from '@/lib/utils';
import {
  addTagToHousehold,
  createAndAddTagToHousehold,
  removeTagFromHousehold,
} from './actions';
import {
  DEFAULT_TAG_COLOR,
  normalizeTagColor,
  TAG_COLORS,
  TAG_COLOR_CHIP_CLASS,
  TAG_COLOR_LABELS,
  TAG_COLOR_SWATCH_CLASS,
  type TagColor,
} from './tag-colors';
import { initialTagFormState } from './tag-types';

export type TagItem = {
  id: string;
  name: string;
  color: string | null;
};

type Props = {
  householdId: string;
  /** この世帯に付与済みのタグ。 */
  assignedTags: TagItem[];
  /** テナント内の全タグ (候補)。付与済みは候補から除外して表示する。 */
  allTags: TagItem[];
};

export function HouseholdTagEditor({
  householdId,
  assignedTags,
  allTags,
}: Props) {
  const [creating, setCreating] = useState(false);
  const [color, setColor] = useState<TagColor>(DEFAULT_TAG_COLOR);
  const [, startTransition] = useTransition();
  const [createState, createAction, isCreating] = useActionState(
    createAndAddTagToHousehold,
    initialTagFormState,
  );

  useEffect(() => {
    if (createState.status === 'success') {
      setCreating(false);
      setColor(DEFAULT_TAG_COLOR);
    }
  }, [createState.status]);

  const assignedIds = new Set(assignedTags.map((t) => t.id));
  const candidates = allTags.filter((t) => !assignedIds.has(t.id));

  function handleAttach(tagId: string) {
    const formData = new FormData();
    formData.set('householdId', householdId);
    formData.set('tagId', tagId);
    startTransition(() => {
      void addTagToHousehold(formData);
    });
  }

  function handleRemove(tagId: string) {
    const formData = new FormData();
    formData.set('householdId', householdId);
    formData.set('tagId', tagId);
    startTransition(() => {
      void removeTagFromHousehold(formData);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {assignedTags.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            まだタグは付いていません。気づきや申し送り事項をタグで残せます。
          </p>
        ) : (
          assignedTags.map((t) => (
            <span
              key={t.id}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm',
                TAG_COLOR_CHIP_CLASS[normalizeTagColor(t.color)],
              )}
            >
              {t.name}
              <button
                type="button"
                aria-label={`${t.name} を外す`}
                onClick={() => handleRemove(t.id)}
                className="ml-0.5 rounded-full px-1 leading-none opacity-70 hover:opacity-100"
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>

      {candidates.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">既存タグから付与:</span>
          {candidates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => handleAttach(t.id)}
              className={cn(
                'inline-flex items-center rounded-full border px-3 py-1 text-sm transition-colors hover:brightness-95',
                TAG_COLOR_CHIP_CLASS[normalizeTagColor(t.color)],
              )}
            >
              ＋ {t.name}
            </button>
          ))}
        </div>
      )}

      {!creating ? (
        <Button variant="secondary" size="sm" onClick={() => setCreating(true)}>
          ＋ 新規タグを作成して付与
        </Button>
      ) : (
        <form action={createAction} className="rounded-lg border border-border bg-muted/40 p-4">
          <input type="hidden" name="householdId" value={householdId} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="タグ名" required error={createState.error}>
              {(p) => (
                <Input
                  id={p.id}
                  name="name"
                  maxLength={30}
                  defaultValue={createState.values?.name ?? ''}
                  aria-invalid={p.invalid}
                  aria-describedby={p.describedBy}
                  placeholder="例: 確認事項あり"
                />
              )}
            </FormField>
            <FormField label="色">
              {(p) => (
                <div
                  id={p.id}
                  role="radiogroup"
                  aria-label="タグの色"
                  className="flex flex-wrap gap-2"
                >
                  <input type="hidden" name="color" value={color} />
                  {TAG_COLORS.map((c) => {
                    const selected = c === color;
                    return (
                      <button
                        key={c}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-label={TAG_COLOR_LABELS[c]}
                        title={TAG_COLOR_LABELS[c]}
                        onClick={() => setColor(c)}
                        className={cn(
                          'flex items-center gap-1.5 rounded-full border px-2 py-1 text-sm transition',
                          selected
                            ? 'border-foreground ring-2 ring-foreground/30'
                            : 'border-border hover:bg-muted',
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            'h-4 w-4 rounded-full border border-black/10',
                            TAG_COLOR_SWATCH_CLASS[c],
                          )}
                        />
                        <span className="text-muted-foreground">
                          {TAG_COLOR_LABELS[c]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </FormField>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Button type="submit" size="sm" disabled={isCreating}>
              {isCreating ? '作成中…' : '作成して付与'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setCreating(false)}
            >
              キャンセル
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
