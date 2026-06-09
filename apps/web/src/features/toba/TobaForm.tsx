'use client';

import { useActionState, useEffect, useRef } from 'react';
import {
  Button,
  FormField,
  Input,
  Select,
  Textarea,
} from '@/components/ui';
import { initialTobaFormState, type TobaFormState } from './types';

type TobaAction = (
  prev: TobaFormState,
  formData: FormData,
) => Promise<TobaFormState>;

export type TargetPersonOption = {
  id: string;
  name: string;
};

type Props = {
  action: TobaAction;
  submitLabel: string;
  memorialServiceId: string;
  targetPersons: TargetPersonOption[];
  /** 編集時に hidden 送信する塔婆 ID */
  tobaId?: string;
  initialValues?: {
    applicantName?: string;
    targetPersonId?: string;
    count?: string;
    inscription?: string;
    offeringAmount?: string;
    memo?: string;
  };
  /** 保存成功 (status idle に戻った) ときに呼ばれる */
  onSaved?: () => void;
  onCancel?: () => void;
};

export function TobaForm({
  action,
  submitLabel,
  memorialServiceId,
  targetPersons,
  tobaId,
  initialValues,
  onSaved,
  onCancel,
}: Props) {
  const [state, formAction, isPending] = useActionState(
    action,
    initialTobaFormState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const prevPending = useRef(false);
  const iv = initialValues ?? {};

  // 送信完了 (pending 立ち下がり) かつエラーなしなら成功扱い。
  useEffect(() => {
    if (prevPending.current && !isPending && state.status === 'idle') {
      if (!tobaId) formRef.current?.reset();
      onSaved?.();
    }
    prevPending.current = isPending;
  }, [isPending, state.status, tobaId, onSaved]);

  return (
    <form ref={formRef} action={formAction} noValidate className="space-y-4">
      <input type="hidden" name="memorialServiceId" value={memorialServiceId} />
      {tobaId && <input type="hidden" name="tobaId" value={tobaId} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="申込者名" required error={state.errors?.applicantName}>
          {(p) => (
            <Input
              id={p.id}
              name="applicantName"
              aria-invalid={p.invalid}
              aria-describedby={p.describedBy}
              defaultValue={state.values?.applicantName ?? iv.applicantName ?? ''}
              placeholder="例: 山田太郎"
            />
          )}
        </FormField>

        <FormField
          label="対象故人 (任意)"
          error={state.errors?.targetPersonId}
          hint={
            targetPersons.length === 0
              ? '過去帳に登録された故人がいません'
              : undefined
          }
        >
          {(p) => (
            <Select
              id={p.id}
              name="targetPersonId"
              aria-invalid={p.invalid}
              aria-describedby={p.describedBy}
              defaultValue={state.values?.targetPersonId ?? iv.targetPersonId ?? ''}
            >
              <option value="">指定しない</option>
              {targetPersons.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </Select>
          )}
        </FormField>
      </div>

      <FormField
        label="表記文字列"
        required
        error={state.errors?.inscription}
        hint="塔婆に書く文言 (戒名・施主名など)"
      >
        {(p) => (
          <Textarea
            id={p.id}
            name="inscription"
            rows={2}
            aria-invalid={p.invalid}
            aria-describedby={p.describedBy}
            defaultValue={state.values?.inscription ?? iv.inscription ?? ''}
            placeholder="例: 釋浄信 / 為先祖代々之霊位"
          />
        )}
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="本数" required error={state.errors?.count}>
          {(p) => (
            <Input
              id={p.id}
              name="count"
              type="number"
              inputMode="numeric"
              min={1}
              aria-invalid={p.invalid}
              aria-describedby={p.describedBy}
              defaultValue={state.values?.count ?? iv.count ?? '1'}
            />
          )}
        </FormField>

        <FormField
          label="御布施額 (任意)"
          error={state.errors?.offeringAmount}
          hint="会計連携の布石。円単位"
        >
          {(p) => (
            <Input
              id={p.id}
              name="offeringAmount"
              type="number"
              inputMode="numeric"
              min={0}
              aria-invalid={p.invalid}
              aria-describedby={p.describedBy}
              defaultValue={state.values?.offeringAmount ?? iv.offeringAmount ?? ''}
              placeholder="例: 3000"
            />
          )}
        </FormField>
      </div>

      <FormField label="備考 (任意)" error={state.errors?.memo}>
        {(p) => (
          <Textarea
            id={p.id}
            name="memo"
            rows={2}
            aria-invalid={p.invalid}
            aria-describedby={p.describedBy}
            defaultValue={state.values?.memo ?? iv.memo ?? ''}
          />
        )}
      </FormField>

      <div className="flex flex-wrap items-center gap-3 pt-1">
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
