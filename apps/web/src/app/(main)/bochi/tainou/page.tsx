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
import { listDelinquentPlots } from '@/features/bochi/queries';
import { currentFiscalYear, formatYen } from '@/features/bochi/format';

function parseYearParam(raw: string | undefined, fallback: number): number {
  if (!raw || !/^\d{4}$/.test(raw)) return fallback;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n) || n < 2000 || n > 2200) return fallback;
  return n;
}

export default async function DelinquentPlotsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const sp = await searchParams;
  const year = parseYearParam(sp.year, currentFiscalYear());
  const plots = await listDelinquentPlots(year);

  const totalOutstanding = plots.reduce((s, p) => s + p.totalOutstanding, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="滞納区画"
        description="管理料が未納の区画を、累積未納額・滞納年数とともに一覧します。"
        breadcrumbs={[
          { label: 'ダッシュボード', href: '/dashboard' },
          { label: '墓地管理料', href: '/bochi' },
          { label: '滞納区画' },
        ]}
        actions={
          plots.length > 0 ? (
            <Link href={`/bochi/saikoku?year=${year}`}>
              <Button>催告状を出す</Button>
            </Link>
          ) : undefined
        }
      />

      {plots.length === 0 ? (
        <EmptyState
          title="滞納している区画はありません"
          description="未納の残る区画はありません。すべての管理料が納入済みです。"
          action={
            <Link href="/bochi">
              <Button>墓地管理料へ戻る</Button>
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardContent className="py-4">
                <p className="text-sm text-muted-foreground">滞納区画数</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">
                  {plots.length} 区画
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <p className="text-sm text-muted-foreground">累積未納額 合計</p>
                <p className="mt-1 text-2xl font-semibold text-danger">
                  {formatYen(totalOutstanding)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* PC: テーブル */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>区画</TableHead>
                  <TableHead>契約世帯</TableHead>
                  <TableHead className="text-right">滞納年数</TableHead>
                  <TableHead className="text-right">未納年度数</TableHead>
                  <TableHead className="text-right">累積未納額</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plots.map((p) => (
                  <TableRow key={p.gravePlotId}>
                    <TableCell>
                      <Link
                        href={`/kukaku/${p.gravePlotId}`}
                        className="text-info hover:underline"
                      >
                        区画 {p.plotNumber}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {p.missingHousehold ? (
                        <Badge variant="warning">契約世帯なし</Badge>
                      ) : (
                        <span>
                          {p.householderName} 様
                          {p.missingAddress && (
                            <Badge variant="warning" className="ml-2">
                              住所未登録
                            </Badge>
                          )}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-foreground">
                      {p.elapsedYears} 年
                      <span className="ml-1 text-sm text-muted-foreground">
                        ({p.oldestUnpaidYear} 年〜)
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-foreground">
                      {p.unpaidYearCount} 年度
                    </TableCell>
                    <TableCell className="text-right font-medium text-danger">
                      {formatYen(p.totalOutstanding)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* スマホ: カード */}
          <ul className="space-y-3 md:hidden">
            {plots.map((p) => (
              <li
                key={p.gravePlotId}
                className="rounded-lg border border-border bg-surface p-4 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <Link
                    href={`/kukaku/${p.gravePlotId}`}
                    className="font-medium text-info hover:underline"
                  >
                    区画 {p.plotNumber}
                  </Link>
                  <span className="font-medium text-danger">
                    {formatYen(p.totalOutstanding)}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  {p.missingHousehold ? (
                    <Badge variant="warning">契約世帯なし</Badge>
                  ) : (
                    <span>{p.householderName} 様</span>
                  )}
                  <span>滞納 {p.elapsedYears} 年</span>
                  <span>未納 {p.unpaidYearCount} 年度</span>
                  {p.missingAddress && <Badge variant="warning">住所未登録</Badge>}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
