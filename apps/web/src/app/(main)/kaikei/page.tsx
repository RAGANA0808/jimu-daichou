import type { TransactionCategory, TransactionDirection } from '@prisma/client';
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
  listTransactionsByMonth,
  summarizeTransactions,
  type TransactionListFilter,
  type TransactionWithHousehold,
} from '@/features/kaikei/queries';
import {
  TRANSACTION_CATEGORY_LABELS,
  TRANSACTION_CATEGORY_ORDER,
  TRANSACTION_DIRECTION_LABELS,
} from '@/features/kaikei/types';

function parseDirectionParam(
  raw: string | undefined,
): TransactionDirection | undefined {
  return raw === 'INCOME' || raw === 'EXPENSE' ? raw : undefined;
}

function parseCategoryParam(
  raw: string | undefined,
): TransactionCategory | undefined {
  return raw && (TRANSACTION_CATEGORY_ORDER as string[]).includes(raw)
    ? (raw as TransactionCategory)
    : undefined;
}

function formatJaDate(d: Date): string {
  return `${d.getUTCFullYear()}/${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

function formatYen(amount: number): string {
  return `${amount.toLocaleString('ja-JP')} 円`;
}

function todayJst(): { year: number; month: number } {
  // Asia/Tokyo は UTC+9 固定。.env で TZ=Asia/Tokyo 設定済み。
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function parseYearMonthParam(
  raw: string | undefined,
  fallback: { year: number; month: number },
): { year: number; month: number } {
  if (!raw) return fallback;
  const m = /^(\d{4})-(\d{2})$/.exec(raw);
  if (!m) return fallback;
  const year = Number.parseInt(m[1]!, 10);
  const month = Number.parseInt(m[2]!, 10);
  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    year < 2000 ||
    year > 2200 ||
    month < 1 ||
    month > 12
  ) {
    return fallback;
  }
  return { year, month };
}

function shiftYearMonth(
  ym: { year: number; month: number },
  delta: number,
): { year: number; month: number } {
  // delta は -1 / +1 を想定
  const total = ym.year * 12 + (ym.month - 1) + delta;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

function formatYearMonthParam(ym: { year: number; month: number }): string {
  return `${ym.year}-${String(ym.month).padStart(2, '0')}`;
}

export default async function KaikeiListPage({
  searchParams,
}: {
  searchParams: Promise<{ ym?: string; dir?: string; cat?: string }>;
}) {
  const sp = await searchParams;
  const today = todayJst();
  const ym = parseYearMonthParam(sp.ym, today);
  const filter: TransactionListFilter = {
    direction: parseDirectionParam(sp.dir),
    category: parseCategoryParam(sp.cat),
  };
  const hasFilter = Boolean(filter.direction || filter.category);
  const txs = await listTransactionsByMonth(ym.year, ym.month, filter);
  const summary = summarizeTransactions(txs);

  const prev = shiftYearMonth(ym, -1);
  const next = shiftYearMonth(ym, +1);
  const clearFilterHref = `/kaikei?ym=${formatYearMonthParam(ym)}`;
  const isThisMonth = ym.year === today.year && ym.month === today.month;

  return (
    <div className="space-y-4">
      <PageHeader
        title="会計"
        description="月別の入出金記録 (護持会費・御布施・寄付・経費 等)"
        breadcrumbs={[
          { label: 'ダッシュボード', href: '/dashboard' },
          { label: '会計' },
        ]}
        actions={
          <>
            <Link href="/kaikei/shukei">
              <Button variant="secondary">年度集計</Button>
            </Link>
            <Link href="/kaikei/new">
              <Button>＋ 入出金を登録</Button>
            </Link>
          </>
        }
      />

      {/* 月ナビ */}
      <Card>
        <CardContent className="flex items-center gap-3 py-3">
          <Link href={`/kaikei?ym=${formatYearMonthParam(prev)}`}>
            <Button variant="secondary" size="sm">
              ← {prev.year}年{prev.month}月
            </Button>
          </Link>
          <h2 className="flex-1 text-center text-lg font-medium text-foreground">
            {ym.year} 年 {ym.month} 月
          </h2>
          <Link href={`/kaikei?ym=${formatYearMonthParam(next)}`}>
            <Button variant="secondary" size="sm">
              {next.year}年{next.month}月 →
            </Button>
          </Link>
          {!isThisMonth && (
            <Link href="/kaikei">
              <Button variant="secondary" size="sm">
                今月へ
              </Button>
            </Link>
          )}
        </CardContent>
      </Card>

      {hasFilter && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-brand-soft bg-brand-soft p-3 text-sm">
          <span className="text-brand-soft-foreground">絞り込み中:</span>
          {filter.direction && (
            <span className="rounded-full bg-surface px-3 py-1 text-brand-soft-foreground">
              {TRANSACTION_DIRECTION_LABELS[filter.direction]}
            </span>
          )}
          {filter.category && (
            <span className="rounded-full bg-surface px-3 py-1 text-brand-soft-foreground">
              {TRANSACTION_CATEGORY_LABELS[filter.category]}
            </span>
          )}
          <Link
            href={clearFilterHref}
            className="ml-1 rounded-full border border-brand px-3 py-1 text-brand-soft-foreground hover:bg-surface"
          >
            解除 ✕
          </Link>
        </div>
      )}

      {/* サマリ */}
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="収入" value={formatYen(summary.income)} />
        <SummaryCard label="支出" value={formatYen(summary.expense)} />
        <SummaryCard
          label="差引"
          value={formatYen(summary.net)}
          negative={summary.net < 0}
        />
      </div>

      {summary.byCategory.length > 0 && (
        <Card>
          <CardContent className="py-3.5">
            <h3 className="text-sm font-medium text-foreground">
              カテゴリ別内訳
            </h3>
            <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              {TRANSACTION_CATEGORY_ORDER.flatMap((cat) =>
                summary.byCategory
                  .filter((b) => b.category === cat)
                  .map((b) => (
                    <li
                      key={`${b.direction}:${b.category}`}
                      className="flex items-center justify-between rounded-lg border border-border bg-muted px-3 py-2"
                    >
                      <span className="text-foreground">
                        <span className="text-xs text-muted-foreground">
                          [{TRANSACTION_DIRECTION_LABELS[b.direction]}]
                        </span>{' '}
                        {TRANSACTION_CATEGORY_LABELS[b.category]} ({b.count} 件)
                      </span>
                      <span className="font-medium text-foreground">
                        {formatYen(b.total)}
                      </span>
                    </li>
                  )),
              )}
            </ul>
          </CardContent>
        </Card>
      )}

      {txs.length === 0 ? (
        <EmptyState
          title={`${ym.year} 年 ${ym.month} 月の入出金記録はありません`}
          description="「＋ 入出金を登録」から追加してください。"
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{txs.length} 件</p>
          <TransactionTable txs={txs} />
        </>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  negative,
}: {
  label: string;
  value: string;
  negative?: boolean;
}) {
  return (
    <Card>
      <CardContent className="py-3.5">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p
          className={`mt-1 text-2xl font-semibold ${
            negative ? 'text-danger' : 'text-foreground'
          }`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function TransactionTable({ txs }: { txs: TransactionWithHousehold[] }) {
  return (
    <>
      {/* PC: テーブル */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>日付</TableHead>
              <TableHead>区分</TableHead>
              <TableHead>カテゴリ</TableHead>
              <TableHead>世帯</TableHead>
              <TableHead className="text-right">金額</TableHead>
              <TableHead>支払方法</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {txs.map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  <Link
                    href={`/kaikei/${t.id}`}
                    className="text-foreground hover:underline"
                  >
                    {formatJaDate(t.paidAt)}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={t.direction === 'INCOME' ? 'success' : 'warning'}
                  >
                    {TRANSACTION_DIRECTION_LABELS[t.direction]}
                  </Badge>
                </TableCell>
                <TableCell>{TRANSACTION_CATEGORY_LABELS[t.category]}</TableCell>
                <TableCell>
                  {t.household ? (
                    <Link
                      href={`/danshintoto/${t.household.id}`}
                      className="text-info hover:underline"
                    >
                      {t.household.householderName}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">— (寺側)</span>
                  )}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatYen(t.amount)}
                </TableCell>
                <TableCell>
                  {t.paymentMethod ?? (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Link href={`/kaikei/${t.id}/edit`}>
                    <Button variant="secondary" size="sm">
                      編集
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* スマホ: カード */}
      <ul className="space-y-3 md:hidden">
        {txs.map((t) => (
          <li key={t.id}>
            <Card>
              <CardContent className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <Link
                    href={`/kaikei/${t.id}`}
                    className="text-foreground hover:underline"
                  >
                    {formatJaDate(t.paidAt)}
                  </Link>
                  <Badge
                    variant={t.direction === 'INCOME' ? 'success' : 'warning'}
                  >
                    {TRANSACTION_DIRECTION_LABELS[t.direction]}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-foreground">
                    {TRANSACTION_CATEGORY_LABELS[t.category]}
                  </span>
                  <span className="text-lg font-medium text-foreground">
                    {formatYen(t.amount)}
                  </span>
                </div>
                {t.household ? (
                  <Link
                    href={`/danshintoto/${t.household.id}`}
                    className="inline-block text-sm text-info hover:underline"
                  >
                    {t.household.householderName}
                  </Link>
                ) : (
                  <p className="text-sm text-muted-foreground">— (寺側)</p>
                )}
                {t.paymentMethod && (
                  <p className="text-sm text-muted-foreground">
                    支払方法: {t.paymentMethod}
                  </p>
                )}
                <div>
                  <Link href={`/kaikei/${t.id}/edit`}>
                    <Button variant="secondary" size="sm">
                      編集
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
