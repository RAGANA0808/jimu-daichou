'use client';

import { useActionState } from 'react';
import { Button, Card, CardContent, FormField, Input } from '@/components/ui';
import { recordPaymentAction } from './actions';
import { initialPaymentFormState } from './types';

const inputDateClass =
  'block min-h-touch w-full rounded border border-border bg-surface px-3 py-2 text-base text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-info aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger';

type Props = {
  invoiceId: string;
  /** 残額 (円)。入力欄の初期値に使う。 */
  outstanding: number;
  /** 入金日の初期値 (YYYY-MM-DD)。 */
  defaultPaidAt: string;
};

export function PaymentForm({ invoiceId, outstanding, defaultPaidAt }: Props) {
  const [state, formAction, isPending] = useActionState(
    recordPaymentAction,
    initialPaymentFormState,
  );

  const v = state.values ?? {};

  return (
    <Card>
      <CardContent className="py-6">
        <form action={formAction} noValidate className="space-y-5">
          <input type="hidden" name="invoiceId" value={invoiceId} />

          <FormField
            label="入金額"
            required
            error={state.errors?.amount}
            hint="今回お預かりした額 (円) を入力します。"
          >
            {(p) => (
              <Input
                id={p.id}
                name="amount"
                inputMode="numeric"
                defaultValue={v.amount ?? (outstanding > 0 ? String(outstanding) : '')}
                placeholder="例: 10000"
                aria-invalid={p.invalid}
                aria-describedby={p.describedBy}
              />
            )}
          </FormField>

          <FormField label="入金日" required error={state.errors?.paidAt}>
            {(p) => (
              <input
                id={p.id}
                name="paidAt"
                type="date"
                defaultValue={v.paidAt ?? defaultPaidAt}
                aria-invalid={p.invalid}
                aria-describedby={p.describedBy}
                className={inputDateClass}
              />
            )}
          </FormField>

          <FormField
            label="支払方法"
            error={state.errors?.paymentMethod}
            hint="現金・振込 など (任意)。"
          >
            {(p) => (
              <Input
                id={p.id}
                name="paymentMethod"
                defaultValue={v.paymentMethod ?? ''}
                placeholder="例: 現金"
                aria-invalid={p.invalid}
                aria-describedby={p.describedBy}
              />
            )}
          </FormField>

          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            入金を記録すると、会計にも護持会費の収入として自動で計上されます
            （同じ請求への入金はまとめて 1 件の会計記録に反映され、二重に計上されません）。
          </div>

          <Button type="submit" size="lg" disabled={isPending}>
            {isPending ? '記録中…' : '入金を記録する'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
