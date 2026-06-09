'use client';

import { useActionState, useEffect } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  FormField,
  Input,
  Textarea,
  useToast,
} from '@/components/ui';
import { updateAccountAction } from './actions';
import { initialAccountFormState } from './types';
import type { PostalTransferAccount } from './queries';

export function AccountForm({
  account,
}: {
  account: PostalTransferAccount | null;
}) {
  const { toast } = useToast();
  const [state, formAction, isPending] = useActionState(
    updateAccountAction,
    initialAccountFormState,
  );

  useEffect(() => {
    if (state.status === 'success') {
      toast({ title: '口座情報を保存しました', variant: 'success' });
    } else if (state.status === 'error' && state.formError) {
      toast({ title: state.formError, variant: 'danger' });
    }
  }, [state, toast]);

  const v = state.values;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">寺の口座情報（払込先）</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-5">
          <FormField
            label="加入者名（口座名義）"
            error={state.errors?.postalAccountName}
            hint="空欄の場合は寺院名を印字します。"
          >
            {(p) => (
              <Input
                id={p.id}
                name="postalAccountName"
                defaultValue={v?.postalAccountName ?? account?.postalAccountName ?? ''}
                aria-invalid={p.invalid}
                aria-describedby={p.describedBy}
                placeholder={account?.name ?? '例: ○○寺'}
              />
            )}
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="口座記号"
              error={state.errors?.postalAccountSymbol}
            >
              {(p) => (
                <Input
                  id={p.id}
                  name="postalAccountSymbol"
                  defaultValue={
                    v?.postalAccountSymbol ?? account?.postalAccountSymbol ?? ''
                  }
                  aria-invalid={p.invalid}
                  aria-describedby={p.describedBy}
                  placeholder="例: 00100"
                />
              )}
            </FormField>
            <FormField
              label="口座番号"
              error={state.errors?.postalAccountNumber}
            >
              {(p) => (
                <Input
                  id={p.id}
                  name="postalAccountNumber"
                  defaultValue={
                    v?.postalAccountNumber ?? account?.postalAccountNumber ?? ''
                  }
                  aria-invalid={p.invalid}
                  aria-describedby={p.describedBy}
                  placeholder="例: 1234567"
                />
              )}
            </FormField>
          </div>

          <FormField
            label="通信欄の既定文"
            error={state.errors?.postalTransferNote}
            hint="振替用紙の通信欄・別紙明細に印字する固定文です（任意）。"
          >
            {(p) => (
              <Textarea
                id={p.id}
                name="postalTransferNote"
                rows={2}
                defaultValue={
                  v?.postalTransferNote ?? account?.postalTransferNote ?? ''
                }
                aria-invalid={p.invalid}
                aria-describedby={p.describedBy}
                placeholder="例: 平素より当山の護持運営にご高配を賜り厚く御礼申し上げます。"
              />
            )}
          </FormField>

          <div className="rounded-lg border border-border bg-muted/40 p-4">
            <p className="mb-3 text-sm font-medium text-foreground">
              印字位置オフセット（mm）
            </p>
            <p className="mb-3 text-sm text-muted-foreground">
              既製の払込取扱票に重ね印刷したとき、全体の印字位置を上下左右にずらして微調整します。プラスで右・下へ移動します（-30〜30mm）。
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label="横方向（X）"
                error={state.errors?.postalPrintOffsetXMm}
              >
                {(p) => (
                  <Input
                    id={p.id}
                    name="postalPrintOffsetXMm"
                    type="number"
                    step="0.5"
                    defaultValue={
                      v?.postalPrintOffsetXMm ??
                      String(account?.postalPrintOffsetXMm ?? 0)
                    }
                    aria-invalid={p.invalid}
                    aria-describedby={p.describedBy}
                  />
                )}
              </FormField>
              <FormField
                label="縦方向（Y）"
                error={state.errors?.postalPrintOffsetYMm}
              >
                {(p) => (
                  <Input
                    id={p.id}
                    name="postalPrintOffsetYMm"
                    type="number"
                    step="0.5"
                    defaultValue={
                      v?.postalPrintOffsetYMm ??
                      String(account?.postalPrintOffsetYMm ?? 0)
                    }
                    aria-invalid={p.invalid}
                    aria-describedby={p.describedBy}
                  />
                )}
              </FormField>
            </div>
          </div>

          <Button type="submit" size="lg" disabled={isPending}>
            {isPending ? '保存中…' : '口座情報を保存'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
