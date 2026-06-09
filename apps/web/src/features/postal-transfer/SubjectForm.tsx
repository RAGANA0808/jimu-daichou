'use client';

import { useActionState, useEffect } from 'react';
import type { PostalTransferSubject } from '@prisma/client';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  FormField,
  Input,
  Select,
  useToast,
} from '@/components/ui';
import { createSubjectAction, updateSubjectAction } from './actions';
import { initialSubjectFormState, AMOUNT_SOURCE_LABELS } from './types';
import { POSTAL_AMOUNT_SOURCES } from '@/lib/postal-transfer';

export function SubjectForm({
  subject,
}: {
  subject?: PostalTransferSubject;
}) {
  const editing = Boolean(subject);
  const { toast } = useToast();
  const [state, formAction, isPending] = useActionState(
    editing ? updateSubjectAction : createSubjectAction,
    initialSubjectFormState,
  );

  useEffect(() => {
    if (state.status === 'error' && state.formError) {
      toast({ title: state.formError, variant: 'danger' });
    }
  }, [state, toast]);

  const v = state.values;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          {editing ? '科目の編集' : '科目を追加'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-5">
          {subject && (
            <input type="hidden" name="subjectId" value={subject.id} />
          )}

          <FormField label="科目名" required error={state.errors?.name}>
            {(p) => (
              <Input
                id={p.id}
                name="name"
                defaultValue={v?.name ?? subject?.name ?? ''}
                aria-invalid={p.invalid}
                aria-describedby={p.describedBy}
                placeholder="例: 護持会費"
              />
            )}
          </FormField>

          <FormField
            label="既定金額（円）"
            error={state.errors?.defaultAmount}
            hint="世帯ごとに差し込むときの初期値。連動元がある場合は当年度請求額が優先されます。"
          >
            {(p) => (
              <Input
                id={p.id}
                name="defaultAmount"
                type="number"
                inputMode="numeric"
                min={0}
                defaultValue={
                  v?.defaultAmount ?? String(subject?.defaultAmount ?? 0)
                }
                aria-invalid={p.invalid}
                aria-describedby={p.describedBy}
              />
            )}
          </FormField>

          <FormField
            label="金額の連動元"
            error={state.errors?.amountSource}
            hint="当年度の請求額を初期値として流し込みます。"
          >
            {(p) => (
              <Select
                id={p.id}
                name="amountSource"
                defaultValue={v?.amountSource ?? subject?.amountSource ?? 'NONE'}
                aria-invalid={p.invalid}
                aria-describedby={p.describedBy}
              >
                {POSTAL_AMOUNT_SOURCES.map((src) => (
                  <option key={src} value={src}>
                    {AMOUNT_SOURCE_LABELS[src]}
                  </option>
                ))}
              </Select>
            )}
          </FormField>

          <FormField
            label="表示順"
            error={state.errors?.sortOrder}
            hint="小さいほど上に表示されます。"
          >
            {(p) => (
              <Input
                id={p.id}
                name="sortOrder"
                type="number"
                inputMode="numeric"
                min={0}
                defaultValue={v?.sortOrder ?? String(subject?.sortOrder ?? 0)}
                aria-invalid={p.invalid}
                aria-describedby={p.describedBy}
              />
            )}
          </FormField>

          {editing && (
            <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-4">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  name="isVisible"
                  defaultChecked={subject?.isVisible ?? true}
                  className="h-5 w-5"
                />
                <span className="text-base text-foreground">
                  振替用紙・明細に表示する
                </span>
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  name="isActive"
                  defaultChecked={subject?.isActive ?? true}
                  className="h-5 w-5"
                />
                <span className="text-base text-foreground">
                  この科目を使用する（外すと休止）
                </span>
              </label>
            </div>
          )}

          <Button type="submit" size="lg" disabled={isPending}>
            {isPending ? '保存中…' : editing ? '変更を保存' : '科目を追加'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
