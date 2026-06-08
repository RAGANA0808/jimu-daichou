import Link from 'next/link';
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  PageHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import {
  getFiscalYearView,
  listFeePlans,
  listInvoiceFiscalYears,
} from '@/features/gojikai/queries';
import { GenerateInvoicesDialog } from '@/features/gojikai/GenerateInvoicesDialog';
import { currentFiscalYear, formatDbDate, formatYen } from '@/features/gojikai/format';
import {
  INVOICE_STATUS_BADGE_VARIANT,
  INVOICE_STATUS_LABELS,
  MAINTENANCE_FEE_METHOD_LABELS,
} from '@/lib/gojikai';

function parseYearParam(raw: string | undefined, fallback: number): number {
  if (!raw || !/^\d{4}$/.test(raw)) return fallback;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n) || n < 2000 || n > 2200) return fallback;
  return n;
}

export default async function GojikaiPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const sp = await searchParams;
  const thisYear = currentFiscalYear();
  const year = parseYearParam(sp.year, thisYear);

  const [view, plans, knownYears] = await Promise.all([
    getFiscalYearView(year),
    listFeePlans(),
    listInvoiceFiscalYears(),
  ]);

  const activePlanCount = plans.filter((p) => p.isActive).length;
  const { summary, invoices } = view;

  // 年度切替の候補: 既知の年度 + 当年・前後を補完。
  const yearSet = new Set<number>(knownYears);
  yearSet.add(thisYear);
  yearSet.add(thisYear - 1);
  yearSet.add(year);
  const yearOptions = Array.from(yearSet).sort((a, b) => b - a);

  return (
    <div className="space-y-4">
      <PageHeader
        title="護持会費"
        description="年度ごとの会費請求・入金消込・未集金の確認をまとめて行います。"
        breadcrumbs={[
          { label: 'ダッシュボード', href: '/dashboard' },
          { label: '護持会費' },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/gojikai/daichou">
              <Button variant="secondary">会費台帳</Button>
            </Link>
            <GenerateInvoicesDialog
              fiscalYear={year}
              activePlanCount={activePlanCount}
            />
          </div>
        }
      />

      {/* 年度切替 */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 py-4">
          <span className="text-sm text-muted-foreground">年度を選択</span>
          {yearOptions.map((y) => (
            <Link key={y} href={`/gojikai?year=${y}`}>
              <Button
                variant={y === year ? 'primary' : 'secondary'}
                size="sm"
              >
                {y} 年度
              </Button>
            </Link>
          ))}
        </CardContent>
      </Card>

      {/* 集計サマリ */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="請求件数" value={`${summary.invoiceCount} 件`} />
        <SummaryCard label="請求総額" value={formatYen(summary.totalBilled)} />
        <SummaryCard label="入金済" value={formatYen(summary.totalPaid)} />
        <SummaryCard
          label="未収額"
          value={formatYen(summary.outstanding)}
          emphasize={summary.outstanding > 0}
        />
      </div>

      {/* 集金進捗 */}
      <Card>
        <CardContent className="space-y-3 py-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-foreground">
              {year} 年度の集金進捗
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="success">完納 {summary.paidCount}</Badge>
              <Badge variant="warning">一部 {summary.partialCount}</Badge>
              <Badge variant="danger">未納 {summary.unpaidCount}</Badge>
            </div>
          </div>
          <div
            className="h-3 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={summary.collectionRate}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="集金進捗率"
          >
            <div
              className="h-full rounded-full bg-success"
              style={{ width: `${summary.collectionRate}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            集金進捗 {summary.collectionRate}%（入金 {formatYen(summary.totalPaid)} / 請求{' '}
            {formatYen(summary.totalBilled)}）
          </p>
          {summary.unpaidCount + summary.partialCount > 0 && (
            <Link href={`/gojikai/dokusoku?year=${year}`}>
              <Button variant="secondary" size="sm">
                未集金の世帯へ督促状を出す（
                {summary.unpaidCount + summary.partialCount} 世帯）
              </Button>
            </Link>
          )}
        </CardContent>
      </Card>

      {/* 請求一覧 */}
      {invoices.length === 0 ? (
        <EmptyState
          title={`${year} 年度の請求はまだありません`}
          description={
            activePlanCount > 0
              ? '「請求を生成」から、会費台帳をもとに当年度の請求をまとめて作成できます。'
              : 'まず会費台帳に世帯ごとの年額会費を登録してください。'
          }
          action={
            activePlanCount > 0 ? (
              <GenerateInvoicesDialog
                fiscalYear={year}
                activePlanCount={activePlanCount}
              />
            ) : (
              <Link href="/gojikai/daichou/new">
                <Button>会費台帳を登録</Button>
              </Link>
            )
          }
        />
      ) : (
        <>
          {/* PC: テーブル */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>世帯</TableHead>
                  <TableHead>納入区分</TableHead>
                  <TableHead className="text-right">請求額</TableHead>
                  <TableHead className="text-right">入金額</TableHead>
                  <TableHead className="text-right">残額</TableHead>
                  <TableHead>状況</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => {
                  const outstanding = Math.max(0, inv.amount - inv.paidAmount);
                  return (
                    <TableRow key={inv.id}>
                      <TableCell>
                        <Link
                          href={`/gojikai/seikyu/${inv.id}`}
                          className="text-info hover:underline"
                        >
                          {inv.household.householderName} 様
                        </Link>
                      </TableCell>
                      <TableCell>
                        {MAINTENANCE_FEE_METHOD_LABELS[inv.method]}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatYen(inv.amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatYen(inv.paidAmount)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatYen(outstanding)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={INVOICE_STATUS_BADGE_VARIANT[inv.status]}>
                          {INVOICE_STATUS_LABELS[inv.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/gojikai/seikyu/${inv.id}`}>
                          <Button variant="secondary" size="sm">
                            入金記録
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* スマホ: カード */}
          <ul className="space-y-3 md:hidden">
            {invoices.map((inv) => {
              const outstanding = Math.max(0, inv.amount - inv.paidAmount);
              return (
                <li key={inv.id}>
                  <Link
                    href={`/gojikai/seikyu/${inv.id}`}
                    className="block rounded-lg border border-border bg-surface p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-foreground">
                        {inv.household.householderName} 様
                      </span>
                      <Badge variant={INVOICE_STATUS_BADGE_VARIANT[inv.status]}>
                        {INVOICE_STATUS_LABELS[inv.status]}
                      </Badge>
                    </div>
                    <dl className="mt-2 grid grid-cols-3 gap-2 text-sm text-muted-foreground">
                      <div>
                        <dt>請求</dt>
                        <dd className="text-foreground">{formatYen(inv.amount)}</dd>
                      </div>
                      <div>
                        <dt>入金</dt>
                        <dd className="text-foreground">
                          {formatYen(inv.paidAmount)}
                        </dd>
                      </div>
                      <div>
                        <dt>残額</dt>
                        <dd className="text-foreground">{formatYen(outstanding)}</dd>
                      </div>
                    </dl>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {invoices.length > 0 && invoices[0] && (
        <p className="text-xs text-muted-foreground">
          作成日: {formatDbDate(invoices[0].createdAt)}〜
        </p>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p
          className={`mt-1 text-2xl font-semibold ${
            emphasize ? 'text-danger' : 'text-foreground'
          }`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
