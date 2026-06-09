import Link from 'next/link';
import {
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
  listDeletedDeathLedgerEntries,
  type DeletedDeathLedgerItem,
} from '@/features/kakochou/queries';
import { RestoreEntryButton } from '@/features/kakochou/RestoreEntryButton';

function deathDateLabel(e: DeletedDeathLedgerItem): string {
  return formatDeathDateSeireki({
    precision: e.datePrecision,
    year: e.deathYear,
    month: e.deathMonth,
    day: e.deathDay,
  });
}

function formatJaDateTime(d: Date): string {
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

export default async function KakochouDeletedListPage() {
  const entries = await listDeletedDeathLedgerEntries();

  return (
    <div className="space-y-6">
      <PageHeader
        title="除外済みの過去帳"
        description="一覧から除外した故人です。物理削除はしておらず、いつでも復元できます。"
        breadcrumbs={[
          { label: '過去帳', href: '/kakochou' },
          { label: '除外済み' },
        ]}
        actions={
          <Link
            href="/kakochou"
            className={buttonVariants({ variant: 'secondary' })}
          >
            過去帳一覧へ戻る
          </Link>
        }
      />

      {entries.length === 0 ? (
        <EmptyState
          title="除外済みのエントリはありません"
          description="除外した過去帳エントリがここに表示されます。"
        />
      ) : (
        <>
          {/* PC: テーブル表示 */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>俗名 / ふりがな</TableHead>
                  <TableHead>命日</TableHead>
                  <TableHead>世帯</TableHead>
                  <TableHead>除外日 / 操作者</TableHead>
                  <TableHead>理由</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <span className="font-medium text-foreground">
                        {e.secularName}
                      </span>
                      <div className="text-sm text-muted-foreground">
                        {e.person.nameKana}
                      </div>
                    </TableCell>
                    <TableCell className="text-foreground">
                      {deathDateLabel(e)}
                    </TableCell>
                    <TableCell className="text-foreground">
                      {e.person.household.householderName}
                    </TableCell>
                    <TableCell className="text-foreground">
                      {e.deletedAt ? formatJaDateTime(e.deletedAt) : '—'}
                      <div className="text-sm text-muted-foreground">
                        {e.deletedByUser?.displayName ?? '不明'}
                      </div>
                    </TableCell>
                    <TableCell className="text-foreground">
                      {e.deletedReason ?? '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end">
                        <RestoreEntryButton
                          entryId={e.id}
                          secularName={e.secularName}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* スマホ/タブレット: カード表示 */}
          <ul className="space-y-3 md:hidden">
            {entries.map((e) => (
              <li key={e.id}>
                <Card>
                  <CardContent className="space-y-2 py-4">
                    <div>
                      <span className="text-lg font-medium text-foreground">
                        {e.secularName}
                      </span>
                      <div className="text-sm text-muted-foreground">
                        {e.person.nameKana}
                      </div>
                    </div>
                    <p className="text-sm text-foreground">
                      命日: {deathDateLabel(e)} / {e.person.household.householderName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      除外: {e.deletedAt ? formatJaDateTime(e.deletedAt) : '—'}（
                      {e.deletedByUser?.displayName ?? '不明'}）
                    </p>
                    {e.deletedReason && (
                      <p className="text-sm text-muted-foreground">
                        理由: {e.deletedReason}
                      </p>
                    )}
                    <div className="pt-1">
                      <RestoreEntryButton
                        entryId={e.id}
                        secularName={e.secularName}
                      />
                    </div>
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
