'use client';

import { useActionState, useEffect } from 'react';
import { Button, FormField, Select, VoiceTextarea } from '@/components/ui';
import {
  INTERACTION_CATEGORY_LABELS,
  INTERACTION_CATEGORY_ORDER,
  INTERACTION_KIND_LABELS,
  INTERACTION_KIND_ORDER,
  initialInteractionFormState,
  type InteractionFieldName,
  type InteractionFormState,
} from './interaction-types';

type InteractionAction = (
  prev: InteractionFormState,
  formData: FormData,
) => Promise<InteractionFormState>;

type Props = {
  action: InteractionAction;
  householdId: string;
  submitLabel: string;
  /** 編集時のみ hidden 送信する対応履歴 ID */
  interactionNoteId?: string;
  initialValues?: Partial<Record<InteractionFieldName, string>>;
  /** 編集時のピン留め初期値。 */
  initialPinned?: boolean;
  /** キャンセル時の処理 (ダイアログを閉じる等)。省略可。 */
  onCancel?: () => void;
  /** 保存成功時の処理 (フォームを閉じる/リセットする等)。 */
  onSuccess?: () => void;
};

export function InteractionNoteForm({
  action,
  householdId,
  submitLabel,
  interactionNoteId,
  initialValues,
  initialPinned,
  onCancel,
  onSuccess,
}: Props) {
  const [state, formAction, isPending] = useActionState(
    action,
    initialInteractionFormState,
  );
  const iv = initialValues ?? {};

  // 保存成功 (action が status:'success' を返した) を検知して親へ通知。
  useEffect(() => {
    if (state.status === 'success') {
      onSuccess?.();
    }
  }, [state, onSuccess]);

  const kindValue =
    state.values?.kind ?? iv.kind ?? INTERACTION_KIND_ORDER[0] ?? 'NOTE';
  const categoryValue =
    state.values?.category ?? iv.category ?? 'OTHER';
  const contentValue = state.values?.content ?? iv.content ?? '';
  const occurredAtValue = state.values?.occurredAt ?? iv.occurredAt ?? '';
  const pinnedDefault =
    state.values?.isPinned !== undefined
      ? state.values.isPinned === 'true'
      : (initialPinned ?? false);

  return (
    <form action={formAction} noValidate className="space-y-4">
      <input type="hidden" name="householdId" value={householdId} />
      {interactionNoteId && (
        <input
          type="hidden"
          name="interactionNoteId"
          value={interactionNoteId}
        />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="種別" required error={state.errors?.kind}>
          {(p) => (
            <Select
              id={p.id}
              name="kind"
              defaultValue={kindValue}
              aria-invalid={p.invalid}
              aria-describedby={p.describedBy}
            >
              {INTERACTION_KIND_ORDER.map((k) => (
                <option key={k} value={k}>
                  {INTERACTION_KIND_LABELS[k]}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        <FormField label="日時" required error={state.errors?.occurredAt}>
          {(p) => (
            <input
              id={p.id}
              name="occurredAt"
              type="datetime-local"
              defaultValue={occurredAtValue}
              aria-invalid={p.invalid}
              aria-describedby={p.describedBy}
              className="block min-h-touch w-full rounded border border-border bg-surface px-3 py-2 text-base text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-info aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger"
            />
          )}
        </FormField>

        <FormField label="話題" error={state.errors?.category}>
          {(p) => (
            <Select
              id={p.id}
              name="category"
              defaultValue={categoryValue}
              aria-invalid={p.invalid}
              aria-describedby={p.describedBy}
            >
              {INTERACTION_CATEGORY_ORDER.map((c) => (
                <option key={c} value={c}>
                  {INTERACTION_CATEGORY_LABELS[c]}
                </option>
              ))}
            </Select>
          )}
        </FormField>
      </div>

      <FormField
        label="内容"
        required
        error={state.errors?.content}
        hint="お電話・ご訪問の用件、お話の要点などを記録します。"
      >
        {(p) => (
          <VoiceTextarea
            id={p.id}
            name="content"
            rows={4}
            defaultValue={contentValue}
            aria-invalid={p.invalid}
            aria-describedby={p.describedBy}
            placeholder="例: 一周忌のご相談。来月の都合を改めてご連絡いただく予定。"
            voiceFieldLabel="内容"
          />
        )}
      </FormField>

      <label className="flex items-center gap-2 text-base text-foreground">
        <input
          type="checkbox"
          name="isPinned"
          defaultChecked={pinnedDefault}
          className="h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-info"
        />
        伝言として最上部に固定する
      </label>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? '保存中…' : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            キャンセル
          </Button>
        )}
      </div>
    </form>
  );
}
