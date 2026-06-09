import Link from 'next/link';
import { CrossTabExportButton } from '@/features/kaikei/CrossTabExportButton';
import {
  calendarMonthForIndex,
  calendarYearForIndex,
  currentFiscalYearJst,
  type CrossTabRow,
} from '@/features/kaikei/crosstab';
import { getCrossTabByFiscalYear } from '@/features/kaikei/queries';
import { TRANSACTION_CATEGORY_LABELS } from '@/features/kaikei/types';

function parseFiscalYearParam(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n) || n < 2000 || n > 2200) return fallback;
  return n;
}

function formatYen(amount: number): string {
  return amount.toLocaleString('ja-JP');
}

/** クロス集計セル → 月別一覧への遷移 URL。 */
function cellHref(
  fiscalYear: number,
  monthIndex: number,
  direction: 'INCOME' | 'EXPENSE',
  category: string,
): string {
  const year = calendarYearForIndex(monthIndex, fiscalYear);
  const month = calendarMonthForIndex(monthIndex);
  const ym = `${year}-${String(month).padStart(2, '0')}`;
  return `/kaikei?ym=${ym}&dir=${direction}&cat=${category}`;
}

export default async function KaikeiCrossTabPage({
  searchParams,
}: {
  searchParams: Promise<{ fy?: string }>;
}) {
  const sp = await searchParams;
  const current = currentFiscalYearJst();
  const fiscalYear = parseFiscalYearParam(sp.fy, current);
  const result = await getCrossTabByFiscalYear(fiscalYear);

  const prev = fiscalYear - 1;
  const next = fiscalYear + 1;
  const monthIndexes = Array.from({ length: 12 }, (_, i) => i);

  return (
    <div className="space-y-6">
      <div>
        <nav className="text-sm text-muted-foreground">
          <Link href="/dashboard" className="hover:underline">
            ダッシュボード
          </Link>
          <span className="mx-2">/</span>
          <Link href="/kaikei" className="hover:underline">
            会計
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">年度集計</span>
        </nav>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-rounded text-2xl tracking-wider">年度集計</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              科目別・月別のクロス集計 (会計年度は 4 月始まり)
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/kaikei"
              className="rounded border border-border px-3 py-2 text-sm text-foreground hover:bg-muted"
            >
              月別一覧へ
            </Link>
            <CrossTabExportButton fiscalYear={fiscalYear} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4">
        <Link
          href={`/kaikei/shukei?fy=${prev}`}
          className="rounded border border-border px-3 py-1 text-sm text-foreground hover:bg-muted"
        >
          ← {prev} 年度
        </Link>
        <h2 className="flex-1 text-center text-lg font-medium">
          {fiscalYear} 年度
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            ({fiscalYear}年4月 〜 {next}年3月)
          </span>
        </h2>
        <Link
          href={`/kaikei/shukei?fy=${next}`}
          className="rounded border border-border px-3 py-1 text-sm text-foreground hover:bg-muted"
        >
          {next} 年度 →
        </Link>
        {fiscalYear !== current && (
          <Link
            href="/kaikei/shukei"
            className="rounded border border-border px-3 py-1 text-sm text-foreground hover:bg-muted"
          >
            今年度へ
          </Link>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="収入合計" amount={result.yearIncomeTotal} tone="income" />
        <SummaryCard label="支出合計" amount={result.yearExpenseTotal} tone="expense" />
        <SummaryCard label="差引 (純額)" amount={result.yearNetTotal} tone="net" />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-brand text-xs uppercase tracking-wider text-brand-foreground">
            <tr>
              <th className="sticky left-0 z-10 bg-brand px-4 py-3 text-left font-semibold">
                科目
              </th>
              {monthIndexes.map((i) => (
                <th key={i} className="px-3 py-3 text-right font-semibold">
                  {calendarMonthForIndex(i)}月
                </th>
              ))}
              <th className="px-4 py-3 text-right font-semibold">年計</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            <BlockHeaderRow label="収入" />
            {result.incomeRows.length === 0 ? (
              <EmptyBlockRow label="収入の記録はありません" />
            ) : (
              result.incomeRows.map((row) => (
                <DataRow
                  key={`INCOME:${row.category}`}
                  row={row}
                  fiscalYear={fiscalYear}
                />
              ))
            )}
            <TotalRow
              label="収入合計"
              months={result.monthIncomeTotals}
              yearTotal={result.yearIncomeTotal}
            />

            <BlockHeaderRow label="支出" />
            {result.expenseRows.length === 0 ? (
              <EmptyBlockRow label="支出の記録はありません" />
            ) : (
              result.expenseRows.map((row) => (
                <DataRow
                  key={`EXPENSE:${row.category}`}
                  row={row}
                  fiscalYear={fiscalYear}
                />
              ))
            )}
            <TotalRow
              label="支出合計"
              months={result.monthExpenseTotals}
              yearTotal={result.yearExpenseTotal}
            />

            <NetRow
              months={result.monthNetTotals}
              yearTotal={result.yearNetTotal}
            />
          </tbody>
        </table>
      </div>

      <p className="text-sm text-muted-foreground">
        金額をクリックすると、その科目・月の明細一覧へ移動します。
      </p>
    </div>
  );
}

function SummaryCard({
  label,
  amount,
  tone,
}: {
  label: string;
  amount: number;
  tone: 'income' | 'expense' | 'net';
}) {
  const isNegative = tone === 'net' && amount < 0;
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-1 text-2xl font-medium ${
          isNegative ? 'text-danger' : 'text-foreground'
        }`}
      >
        {formatYen(amount)} 円
      </p>
    </div>
  );
}

function BlockHeaderRow({ label }: { label: string }) {
  return (
    <tr className="bg-brand-soft/70">
      <th
        scope="row"
        colSpan={14}
        className="sticky left-0 bg-brand-soft/70 px-4 py-2 text-left text-sm font-semibold text-brand-soft-foreground"
      >
        {label}
      </th>
    </tr>
  );
}

function EmptyBlockRow({ label }: { label: string }) {
  return (
    <tr>
      <td
        colSpan={14}
        className="px-4 py-3 text-center text-sm text-muted-foreground"
      >
        {label}
      </td>
    </tr>
  );
}

function DataRow({
  row,
  fiscalYear,
}: {
  row: CrossTabRow;
  fiscalYear: number;
}) {
  return (
    <tr className="bg-surface hover:bg-muted/60">
      <th
        scope="row"
        className="sticky left-0 z-10 bg-surface px-4 py-3 text-left font-medium text-foreground"
      >
        {TRANSACTION_CATEGORY_LABELS[row.category]}
      </th>
      {row.months.map((cell, i) => (
        <td key={i} className="px-3 py-3 text-right">
          {cell.total === 0 ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <Link
              href={cellHref(
                fiscalYear,
                i,
                row.direction,
                row.category,
              )}
              className="text-foreground hover:text-primary hover:underline"
              title={`${cell.count} 件`}
            >
              {formatYen(cell.total)}
            </Link>
          )}
        </td>
      ))}
      <td className="px-4 py-3 text-right font-medium text-foreground">
        {row.yearTotal.total === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          formatYen(row.yearTotal.total)
        )}
      </td>
    </tr>
  );
}

function TotalRow({
  label,
  months,
  yearTotal,
}: {
  label: string;
  months: number[];
  yearTotal: number;
}) {
  return (
    <tr className="bg-brand-soft">
      <th
        scope="row"
        className="sticky left-0 z-10 bg-brand-soft px-4 py-3 text-left font-semibold text-brand-soft-foreground"
      >
        {label}
      </th>
      {months.map((v, i) => (
        <td
          key={i}
          className="px-3 py-3 text-right font-medium text-brand-soft-foreground"
        >
          {v === 0 ? (
            <span className="text-brand-soft-foreground/40">—</span>
          ) : (
            formatYen(v)
          )}
        </td>
      ))}
      <td className="px-4 py-3 text-right font-semibold text-brand-soft-foreground">
        {formatYen(yearTotal)}
      </td>
    </tr>
  );
}

function NetRow({
  months,
  yearTotal,
}: {
  months: number[];
  yearTotal: number;
}) {
  const cls = (v: number) =>
    v < 0 ? 'text-danger' : 'text-foreground';
  return (
    <tr className="border-t-2 border-border bg-muted">
      <th
        scope="row"
        className="sticky left-0 z-10 bg-muted px-4 py-3 text-left font-semibold text-foreground"
      >
        差引 (純額)
      </th>
      {months.map((v, i) => (
        <td
          key={i}
          className={`px-3 py-3 text-right font-medium ${cls(v)}`}
        >
          {v === 0 ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            formatYen(v)
          )}
        </td>
      ))}
      <td
        className={`px-4 py-3 text-right font-semibold ${cls(yearTotal)}`}
      >
        {formatYen(yearTotal)}
      </td>
    </tr>
  );
}
