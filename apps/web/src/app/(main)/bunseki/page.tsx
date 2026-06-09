import Link from 'next/link';
import {
  BarChart,
  GroupedBarChart,
  LineChart,
  type GroupedBarGroup,
} from '@/components/ui/charts';
import { EmptyState } from '@/components/ui/empty-state';
import { getYearlyTrends, type YearlyTrends } from '@/features/bunseki/queries';

function parseYearsParam(raw: string | undefined): number {
  if (!raw) return 7;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) return 7;
  return n;
}

function formatYen(amount: number): string {
  return amount.toLocaleString('ja-JP');
}

/** 会計年度 → x 軸ラベル (例: 2024年度)。 */
function fyLabel(fy: number): string {
  return `${fy}年度`;
}

export default async function BunsekiPage({
  searchParams,
}: {
  searchParams: Promise<{ years?: string }>;
}) {
  const sp = await searchParams;
  const years = parseYearsParam(sp.years);
  const trends = await getYearlyTrends({ years });

  const labels = trends.axis.map(fyLabel);
  const hasData =
    trends.finance.some((p) => p.income !== 0 || p.expense !== 0) ||
    trends.serviceCounts.some((c) => c !== 0) ||
    trends.householdCounts.some((c) => c !== 0);

  return (
    <div className="space-y-6">
      <div>
        <nav className="text-sm text-muted-foreground">
          <Link href="/dashboard" className="hover:underline">
            ダッシュボード
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">分析</span>
        </nav>
        <div className="mt-2">
          <h1 className="font-rounded text-2xl tracking-wider">分析</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            会計年度 (4 月始まり) ごとの集計値の推移をご覧いただけます。閲覧専用です。
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="有効世帯数" value={`${trends.kpi.activeHouseholds} 世帯`} />
        <KpiCard label="故人数 (過去帳)" value={`${trends.kpi.deceasedCount} 名`} />
        <KpiCard
          label={`今年度の法要件数 (${trends.toFy}年度)`}
          value={`${trends.kpi.servicesThisFy} 件`}
        />
        <KpiCard
          label={`今年度の差引 (${trends.toFy}年度)`}
          value={`${formatYen(trends.kpi.netThisFy)} 円`}
          negative={trends.kpi.netThisFy < 0}
        />
      </div>

      <PeriodSwitch years={trends.years} />

      {!hasData ? (
        <EmptyState
          title="まだ集計できる記録がありません"
          description="入出金・法要・世帯の記録が増えると、ここに会計年度ごとの推移が表示されます。"
        />
      ) : (
        <div className="space-y-6">
          <ChartCard title="収支トレンド (収入・支出)">
            <GroupedBarChart
              groups={buildIncomeExpenseGroups(trends, labels)}
              ariaLabel={`${trends.fromFy}年度から${trends.toFy}年度までの会計年度別の収入と支出の推移`}
              caption="会計年度別の収入・支出・差引"
              valueFormatter={formatYen}
              extraColumns={[
                { header: '差引', values: trends.finance.map((p) => p.net) },
              ]}
            />
          </ChartCard>

          <ChartCard title="差引 (純額) トレンド">
            <LineChart
              series={[
                {
                  name: '差引 (純額)',
                  colorVar: 'var(--brand)',
                  points: trends.finance.map((p) => p.net),
                },
              ]}
              xLabels={labels}
              ariaLabel={`${trends.fromFy}年度から${trends.toFy}年度までの会計年度別の差引 (純額) の推移`}
              caption="会計年度別の差引 (純額)"
              valueFormatter={formatYen}
            />
          </ChartCard>

          <ChartCard title="護持会費トレンド">
            <BarChart
              data={trends.finance.map((p, i) => ({
                label: labels[i] ?? fyLabel(p.fiscalYear),
                value: p.maintenanceFee,
              }))}
              ariaLabel={`${trends.fromFy}年度から${trends.toFy}年度までの会計年度別の護持会費収入の推移`}
              colorVar="var(--brand)"
              caption="会計年度別の護持会費収入"
              valueHeader="護持会費 (円)"
              valueFormatter={formatYen}
            />
          </ChartCard>

          <ChartCard title="法要件数トレンド">
            <BarChart
              data={trends.axis.map((fy, i) => ({
                label: labels[i] ?? fyLabel(fy),
                value: trends.serviceCounts[i] ?? 0,
              }))}
              ariaLabel={`${trends.fromFy}年度から${trends.toFy}年度までの会計年度別の法要件数の推移`}
              colorVar="var(--info)"
              caption="会計年度別の法要件数"
              valueHeader="件数"
            />
          </ChartCard>

          <ChartCard title="新規世帯登録トレンド">
            <BarChart
              data={trends.axis.map((fy, i) => ({
                label: labels[i] ?? fyLabel(fy),
                value: trends.householdCounts[i] ?? 0,
              }))}
              ariaLabel={`${trends.fromFy}年度から${trends.toFy}年度までの会計年度別の新規世帯登録件数の推移`}
              colorVar="var(--accent)"
              caption="会計年度別の新規世帯登録件数"
              valueHeader="件数"
            />
          </ChartCard>
        </div>
      )}

      <div className="rounded-lg border border-border bg-surface p-4 text-sm text-muted-foreground">
        <p>
          本ページは集計値 (件数・金額) のみを表示しており、個々の記録は掲載していません。
        </p>
        <p className="mt-1">
          会計年度は 4 月始まりです (例: 2024年度 = 2024年4月〜2025年3月)。
          会計の集計は入出金日 (会計日) を基準に、法要・新規世帯の集計は予定日・登録日を基準に
          年度へ振り分けています。
        </p>
        <p className="mt-1">
          有効世帯数は現在ご縁のある世帯 (全期間) の数で、新規世帯登録トレンドの
          各年度の登録実績 (離檀済みを含む) とは母集団が異なります。
        </p>
      </div>
    </div>
  );
}

/** 収入/支出の集合棒グラフ用のグループ配列を作る。 */
function buildIncomeExpenseGroups(
  trends: YearlyTrends,
  labels: string[],
): GroupedBarGroup[] {
  return trends.finance.map((p, i) => ({
    label: labels[i] ?? fyLabel(p.fiscalYear),
    values: [
      { name: '収入', value: p.income, colorVar: 'var(--success)' },
      { name: '支出', value: p.expense, colorVar: 'var(--danger)' },
    ],
  }));
}

function KpiCard({
  label,
  value,
  negative = false,
}: {
  label: string;
  value: string;
  negative?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-1 text-2xl font-medium ${
          negative ? 'text-danger' : 'text-foreground'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <h2 className="mb-3 font-rounded text-lg tracking-wide text-foreground">
        {title}
      </h2>
      {children}
    </div>
  );
}

function PeriodSwitch({ years }: { years: number }) {
  const options = [5, 7, 10] as const;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">表示期間:</span>
      {options.map((y) => {
        const active = years === y;
        return (
          <Link
            key={y}
            href={`/bunseki?years=${y}`}
            aria-current={active ? 'page' : undefined}
            className={`rounded border px-3 py-1 ${
              active
                ? 'border-brand bg-brand text-brand-foreground'
                : 'border-border text-foreground hover:bg-muted'
            }`}
          >
            {y}年
          </Link>
        );
      })}
    </div>
  );
}
