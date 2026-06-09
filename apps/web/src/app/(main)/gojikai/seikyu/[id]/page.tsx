import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
} from '@/components/ui';
import { getInvoiceById } from '@/features/gojikai/queries';
import {
  formatDbDate,
  formatYen,
  todayDateInput,
} from '@/features/gojikai/format';
import { PaymentForm } from '@/features/gojikai/PaymentForm';
import {
  INVOICE_STATUS_BADGE_VARIANT,
  INVOICE_STATUS_LABELS,
  MAINTENANCE_FEE_METHOD_LABELS,
} from '@/lib/gojikai';

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invoice = await getInvoiceById(id);
  if (!invoice) {
    notFound();
  }

  const outstanding = Math.max(0, invoice.amount - invoice.paidAmount);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${invoice.household.householderName} 様 の護持会費`}
        description={`${invoice.fiscalYear} 年度の請求`}
        breadcrumbs={[
          { label: 'ダッシュボード', href: '/dashboard' },
          { label: '護持会費', href: '/gojikai' },
          { label: `${invoice.fiscalYear} 年度`, href: `/gojikai?year=${invoice.fiscalYear}` },
          { label: invoice.household.householderName },
        ]}
        actions={
          <Link href={`/danshintoto/${invoice.household.id}`}>
            <Button variant="secondary">カルテを開く</Button>
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 請求内容 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2 text-lg">
              請求内容
              <Badge variant={INVOICE_STATUS_BADGE_VARIANT[invoice.status]}>
                {INVOICE_STATUS_LABELS[invoice.status]}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-base">
              <dt className="text-muted-foreground">年度</dt>
              <dd className="text-foreground">{invoice.fiscalYear} 年度</dd>
              <dt className="text-muted-foreground">納入区分</dt>
              <dd className="text-foreground">
                {MAINTENANCE_FEE_METHOD_LABELS[invoice.method]}
              </dd>
              <dt className="text-muted-foreground">請求額</dt>
              <dd className="text-foreground">{formatYen(invoice.amount)}</dd>
              <dt className="text-muted-foreground">入金済</dt>
              <dd className="text-foreground">{formatYen(invoice.paidAmount)}</dd>
              <dt className="text-muted-foreground">残額</dt>
              <dd
                className={
                  outstanding > 0 ? 'font-medium text-danger' : 'text-foreground'
                }
              >
                {formatYen(outstanding)}
              </dd>
              {invoice.dueDate && (
                <>
                  <dt className="text-muted-foreground">納入期限</dt>
                  <dd className="text-foreground">
                    {formatDbDate(invoice.dueDate)}
                  </dd>
                </>
              )}
            </dl>
            {invoice.transactionId && (
              <p className="mt-4 text-sm text-muted-foreground">
                この請求の入金は会計に計上されています。
                <Link
                  href={`/kaikei/${invoice.transactionId}`}
                  className="ml-1 text-info hover:underline"
                >
                  会計記録を見る
                </Link>
              </p>
            )}
          </CardContent>
        </Card>

        {/* 入金記録 */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">入金を記録</h2>
          {invoice.status === 'PAID' ? (
            <Card>
              <CardContent className="py-6">
                <p className="text-base text-foreground">
                  この請求は完納済みです。追加の入金がある場合は、下のフォームから記録できます。
                </p>
              </CardContent>
            </Card>
          ) : null}
          <PaymentForm
            invoiceId={invoice.id}
            outstanding={outstanding}
            defaultPaidAt={todayDateInput()}
          />
        </div>
      </div>
    </div>
  );
}
