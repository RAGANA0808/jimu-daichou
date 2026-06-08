'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  ConfirmDialog,
  useConfirmDialog,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import {
  INTERACTION_CATEGORY_CHIP_CLASS,
  INTERACTION_CATEGORY_LABELS,
  INTERACTION_CATEGORY_ORDER,
  INTERACTION_KIND_BADGE_VARIANT,
  INTERACTION_KIND_LABELS,
} from './interaction-types';
import { InteractionNoteForm } from './InteractionNoteForm';
import {
  createInteractionNoteAction,
  softDeleteInteractionNoteAction,
  toggleInteractionNotePinAction,
  updateInteractionNoteAction,
} from './interaction-actions';
import type { InteractionCategory, InteractionKind } from '@prisma/client';

export type TimelineNote = {
  id: string;
  kind: InteractionKind;
  category: InteractionCategory;
  isPinned: boolean;
  content: string;
  occurredAt: string; // ISO 文字列 (Server Component から渡す)
  authorName: string | null;
};

type Props = {
  householdId: string;
  notes: TimelineNote[];
  /** 新規フォームの日時プリセット (今日の現在時刻、JST datetime-local 形式)。 */
  defaultOccurredAt: string;
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

/** ISO 文字列を datetime-local の値 (YYYY-MM-DDTHH:mm, JST) に変換する。 */
function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

export function InteractionTimeline({
  householdId,
  notes,
  defaultOccurredAt,
}: Props) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<InteractionCategory | 'ALL'>('ALL');
  const confirm = useConfirmDialog();
  const [, startTransition] = useTransition();

  const editingNote = notes.find((n) => n.id === editingId) ?? null;

  // 実データに存在する話題のみを絞り込みチップ候補にする (ノイズ削減)。
  const availableCategories = useMemo(() => {
    const present = new Set(notes.map((n) => n.category));
    return INTERACTION_CATEGORY_ORDER.filter((c) => present.has(c));
  }, [notes]);

  // 絞り込み適用後、ピン最上部の安定ソート (サーバ側で日付降順済み)。
  const visibleNotes = useMemo(() => {
    const filtered =
      filter === 'ALL' ? notes : notes.filter((n) => n.category === filter);
    return [...filtered].sort(
      (a, b) => Number(b.isPinned) - Number(a.isPinned),
    );
  }, [notes, filter]);

  function handleDelete(noteId: string) {
    confirm.open(() => {
      const formData = new FormData();
      formData.set('interactionNoteId', noteId);
      formData.set('householdId', householdId);
      startTransition(() => {
        void softDeleteInteractionNoteAction(formData);
      });
    });
  }

  function handleTogglePin(note: TimelineNote) {
    const formData = new FormData();
    formData.set('interactionNoteId', note.id);
    formData.set('householdId', householdId);
    formData.set('isPinned', String(!note.isPinned));
    startTransition(() => {
      void toggleInteractionNotePinAction(formData);
    });
  }

  return (
    <div className="space-y-4">
      {!creating ? (
        <div className="flex justify-end">
          <Button onClick={() => setCreating(true)}>＋ 対応を記録する</Button>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-muted/40 p-4">
          <h3 className="mb-3 text-base font-medium text-foreground">
            対応を記録する
          </h3>
          <InteractionNoteForm
            action={createInteractionNoteAction}
            householdId={householdId}
            submitLabel="記録する"
            initialValues={{ occurredAt: defaultOccurredAt }}
            onCancel={() => setCreating(false)}
            onSuccess={() => setCreating(false)}
          />
        </div>
      )}

      {notes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-surface px-4 py-8 text-center text-base text-muted-foreground">
          まだ対応履歴はありません。お電話やご訪問の記録を残しておくと、次にご連絡いただいた際にすぐ振り返れます。
        </p>
      ) : (
        <>
          {availableCategories.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                aria-pressed={filter === 'ALL'}
                onClick={() => setFilter('ALL')}
                className={cn(
                  'inline-flex items-center rounded-full border px-3 py-1 text-sm transition-colors',
                  filter === 'ALL'
                    ? 'border-primary bg-primary text-white'
                    : 'border-border bg-surface text-muted-foreground hover:bg-muted',
                )}
              >
                すべて
              </button>
              {availableCategories.map((c) => {
                const count = notes.filter((n) => n.category === c).length;
                const selected = filter === c;
                return (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setFilter(selected ? 'ALL' : c)}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm transition-colors',
                      selected
                        ? 'ring-2 ring-primary ring-offset-1'
                        : 'hover:brightness-95',
                      INTERACTION_CATEGORY_CHIP_CLASS[c],
                    )}
                  >
                    {INTERACTION_CATEGORY_LABELS[c]}
                    <span className="text-xs opacity-70">{count}</span>
                  </button>
                );
              })}
            </div>
          )}

          <ol className="relative space-y-4 border-l-2 border-border pl-5">
            {visibleNotes.map((n) => (
              <li key={n.id} className="relative">
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute -left-[1.6rem] top-1.5 h-3 w-3 rounded-full border-2 border-surface',
                    n.isPinned ? 'bg-accent' : 'bg-primary',
                  )}
                />
                <div
                  className={cn(
                    'rounded-lg border bg-surface p-4 shadow-sm',
                    n.isPinned
                      ? 'border-l-4 border-l-accent border-border'
                      : 'border-border',
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={INTERACTION_KIND_BADGE_VARIANT[n.kind]}>
                        {INTERACTION_KIND_LABELS[n.kind]}
                      </Badge>
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full border px-2 py-0.5 text-sm',
                          INTERACTION_CATEGORY_CHIP_CLASS[n.category],
                        )}
                      >
                        {INTERACTION_CATEGORY_LABELS[n.category]}
                      </span>
                      {n.isPinned && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent-soft px-2 py-0.5 text-sm text-accent">
                          固定中
                        </span>
                      )}
                      <time className="text-base font-medium text-foreground">
                        {formatJstDateTime(n.occurredAt)}
                      </time>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleTogglePin(n)}
                      >
                        {n.isPinned ? '固定解除' : 'ピン留め'}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setEditingId(n.id)}
                      >
                        編集
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(n.id)}
                      >
                        除外
                      </Button>
                    </div>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-base text-foreground">
                    {n.content}
                  </p>
                  {n.authorName && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      記録者: {n.authorName}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>

          {visibleNotes.length === 0 && (
            <p className="rounded-lg border border-dashed border-border bg-surface px-4 py-6 text-center text-base text-muted-foreground">
              この話題の記録はありません。
            </p>
          )}
        </>
      )}

      <Dialog
        open={editingNote !== null}
        onOpenChange={(open) => {
          if (!open) setEditingId(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogTitle>対応履歴を編集する</DialogTitle>
          {editingNote && (
            <div className="mt-4">
              <InteractionNoteForm
                action={updateInteractionNoteAction}
                householdId={householdId}
                interactionNoteId={editingNote.id}
                submitLabel="保存する"
                initialValues={{
                  kind: editingNote.kind,
                  category: editingNote.category,
                  content: editingNote.content,
                  occurredAt: toDatetimeLocalValue(editingNote.occurredAt),
                }}
                initialPinned={editingNote.isPinned}
                onCancel={() => setEditingId(null)}
                onSuccess={() => setEditingId(null)}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        {...confirm.props}
        title="この対応履歴を除外しますか？"
        description="一覧から外れます。記録自体は残るため、後から復元のご相談も可能です。"
        confirmLabel="除外する"
        destructive
      />
    </div>
  );
}
