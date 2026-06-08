import Link from 'next/link';
import {
  Button,
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
  findAnniversariesForYear,
  sortAnniversaries,
  type NenkiSortKey,
} from '@/features/nenki/queries';

function parseYearParam(raw: string | undefined): number {
  const now = new Date().getFullYear();
  if (!raw) return now;
  const n = Number.parseInt(raw, 10);
  // あまり極端な値は現在年に丸める (タイプミス対策)
  if (Number.isNaN(n) || !Number.isFinite(n) || n < 1800 || n > 2200) {
    return now;
  }
  return n;
}

function parseSortParam(raw: string | undefined): NenkiSortKey {
  return raw === 'kaimyo' ? 'kaimyo' : 'schedule';
}

function formatSchedule(month: number | null, day: number | null): string {
  if (month === null || day === null) return '— (月日不明)';
  return `${month}月${day}日`;
}

export default async function NenkiPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; sort?: string }>;
}) {
  const sp = await searchParams;
  const targetYear = parseYearParam(sp.year);
  const sortKey = parseSortParam(sp.sort);
  const currentYear = new Date().getFullYear();

  const unsorted = await findAnniversariesForYear(targetYear);
  const matches = sortAnniversaries(unsorted, sortKey);
  const householdCount = new Set(matches.map((m) => m.householdId)).size;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`年忌表 ${targetYear} 年`}
        description="この年に年忌を迎える故人の一覧です。離檀された世帯・弔い上げ済みは除いています。"
        breadcrumbs={[
          { label: 'ダッシュボード', href: '/dashboard' },
          { label: '年忌表' },
        ]}
        actions={
          matches.length > 0 ? (
            <Link href={`/hasso/new?year=${targetYear}`}>
              <Button>案内を出す（{householdCount} 世帯）</Button>
            </Link>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link href={`/nenki?year=${targetYear - 1}&sort=${sortKey}`}>
          <Button variant="secondary" size="sm">
            ← {targetYear - 1} 年
          </Button>
        </Link>
        {targetYear !== currentYear && (
          <Link href={`/nenki?sort=${sortKey}`}>
            <Button variant="secondary" size="sm">
              今年 ({currentYear})
            </Button>
          </Link>
        )}
        <Link href={`/nenki?year=${targetYear + 1}&sort=${sortKey}`}>
          <Button variant="secondary" size="sm">
            {targetYear + 1} 年 →
          </Button>
        </Link>
      </div>

      {matches.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <div
            className="inline-flex items-center gap-1"
            role="group"
            aria-label="並び順"
          >
            <span className="mr-1 text-muted-foreground">並び順:</span>
            <Link href={`/nenki?year=${targetYear}&sort=schedule`}>
              <Button
                variant={sortKey === 'schedule' ? 'primary' : 'secondary'}
                size="sm"
              >
                予定日順
              </Button>
            </Link>
            <Link href={`/nenki?year=${targetYear}&sort=kaimyo`}>
              <Button
                variant={sortKey === 'kaimyo' ? 'primary' : 'secondary'}
                size="sm"
              >
                戒名順
              </Button>
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a href={`/api/nenki/csv?year=${targetYear}&sort=${sortKey}`}>
              <Button variant="secondary" size="sm">
                CSV を書き出す（{sortKey === 'kaimyo' ? '戒名順' : '予定日順'}）
              </Button>
            </a>
          </div>
        </div>
      )}

      {matches.length === 0 ? (
        <EmptyState
          title={`${targetYear} 年に年忌を迎える故人はいません`}
          description="前後の年もご確認ください。"
        />
      ) : (
        <>
          {/* PC: テーブル */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>回忌</TableHead>
                  <TableHead>予定日</TableHead>
                  <TableHead>世帯 (施主)</TableHead>
                  <TableHead>俗名</TableHead>
                  <TableHead>戒名</TableHead>
                  <TableHead>命日</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matches.map((m) => (
                  <TableRow key={m.entryId}>
                    <TableCell className="font-medium">
                      {m.anniversary.name}
                    </TableCell>
                    <TableCell>
                      {formatSchedule(m.anniversary.month, m.anniversary.day)}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/danshintoto/${m.householdId}`}
                        className="text-info hover:underline"
                      >
                        {m.householdName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/danshintoto/${m.householdId}/kakochou/${m.entryId}`}
                        className="text-info hover:underline"
                      >
                        {m.secularName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {m.kaimyoName ?? (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {m.deathDate.year}/{m.deathDate.month ?? '—'}/
                      {m.deathDate.day ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* スマホ: カード */}
          <ul className="space-y-3 md:hidden">
            {matches.map((m) => (
              <li
                key={m.entryId}
                className="rounded-lg border border-border bg-surface p-4 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-foreground">
                    {m.anniversary.name}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {formatSchedule(m.anniversary.month, m.anniversary.day)}
                  </span>
                </div>
                <div className="mt-2 text-foreground">
                  <Link
                    href={`/danshintoto/${m.householdId}/kakochou/${m.entryId}`}
                    className="text-info hover:underline"
                  >
                    {m.secularName}
                  </Link>
                  {m.kaimyoName && (
                    <span className="ml-2 text-sm text-muted-foreground">
                      {m.kaimyoName}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  <Link
                    href={`/danshintoto/${m.householdId}`}
                    className="text-info hover:underline"
                  >
                    {m.householdName}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="text-xs text-muted-foreground">
        ※ 対象は 1/3/7/13/17/23/27/33/37/50 回忌です。2/29 が命日の方で、法要年が平年の場合は 3/1 に補正しています。
      </p>
    </div>
  );
}
