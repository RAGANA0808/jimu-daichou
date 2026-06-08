import Link from 'next/link';
import {
  Badge,
  buttonVariants,
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
import { formatDeathDateSeireki } from '@/lib/kakochou';
import {
  listAllDeathLedgerEntries,
  type DeathLedgerListItem,
  type DeathLedgerSort,
} from '@/features/kakochou/queries';
import { KakochouListControls } from '@/features/kakochou/KakochouListControls';

function entryDetailHref(e: DeathLedgerListItem): string {
  return `/danshintoto/${e.person.householdId}/kakochou/${e.id}`;
}

function deathDateLabel(e: DeathLedgerListItem): string {
  return formatDeathDateSeireki({
    precision: e.datePrecision,
    year: e.deathYear,
    month: e.deathMonth,
    day: e.deathDay,
  });
}

export default async function KakochouListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string }>;
}) {
  const sp = await searchParams;
  const query = typeof sp.q === 'string' ? sp.q : '';
  const sort: DeathLedgerSort = sp.sort === 'kana' ? 'kana' : 'date';

  const entries = await listAllDeathLedgerEntries({ sort, query });

  return (
    <div className="space-y-4">
      <PageHeader
        title="過去帳"
        description="お寺全体の故人を横断して一覧・検索できます。"
        actions={
          <Link
            href="/kakochou/jogai"
            className={buttonVariants({ variant: 'secondary' })}
          >
            除外済みを見る
          </Link>
        }
      />

      <KakochouListControls initialQuery={query} sort={sort} />

      {entries.length === 0 ? (
        <EmptyState
          title={
            query.length > 0
              ? '該当する故人が見つかりませんでした'
              : 'まだ過去帳に登録がありません'
          }
          description={
            query.length > 0
              ? '検索条件を変えてお試しください。'
              : '各世帯のカルテから故人を過去帳に登録できます。'
          }
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {entries.length} 件
            {query.length > 0 && `（「${query}」で絞り込み）`}
          </p>

          {/* PC: テーブル表示 (情報密度を活かす) */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>俗名 / ふりがな</TableHead>
                  <TableHead>戒名</TableHead>
                  <TableHead>命日</TableHead>
                  <TableHead>世帯</TableHead>
                  <TableHead>行年</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <Link
                        href={entryDetailHref(e)}
                        className="font-medium text-foreground hover:underline"
                      >
                        {e.secularName}
                      </Link>
                      <div className="text-sm text-muted-foreground">
                        {e.person.nameKana}
                      </div>
                    </TableCell>
                    <TableCell className="text-foreground">
                      {e.kaimyoName ?? '—'}
                    </TableCell>
                    <TableCell>
                      <span className="text-foreground">{deathDateLabel(e)}</span>
                      {e.datePrecision !== 'FULL' && (
                        <Badge variant="neutral" className="ml-2 align-middle">
                          {e.datePrecision === 'UNKNOWN' ? '不明' : '概数'}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/danshintoto/${e.person.householdId}`}
                        className="text-info hover:underline"
                      >
                        {e.person.household.householderName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-foreground">
                      {e.ageAtDeath !== null ? `${e.ageAtDeath} 歳` : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* スマホ/タブレット: カード表示 (縦積み) */}
          <ul className="space-y-3 md:hidden">
            {entries.map((e) => (
              <li key={e.id}>
                <Card>
                  <CardContent className="space-y-2 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Link
                          href={entryDetailHref(e)}
                          className="text-lg font-medium text-foreground hover:underline"
                        >
                          {e.secularName}
                        </Link>
                        <div className="text-sm text-muted-foreground">
                          {e.person.nameKana}
                        </div>
                      </div>
                      {e.ageAtDeath !== null && (
                        <span className="shrink-0 text-sm text-muted-foreground">
                          行年 {e.ageAtDeath}
                        </span>
                      )}
                    </div>
                    {e.kaimyoName && (
                      <p className="text-sm text-foreground">{e.kaimyoName}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-foreground">命日: {deathDateLabel(e)}</span>
                      {e.datePrecision !== 'FULL' && (
                        <Badge variant="neutral">
                          {e.datePrecision === 'UNKNOWN' ? '不明' : '概数'}
                        </Badge>
                      )}
                    </div>
                    <Link
                      href={`/danshintoto/${e.person.householdId}`}
                      className="inline-block text-sm text-info hover:underline"
                    >
                      {e.person.household.householderName}
                    </Link>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
