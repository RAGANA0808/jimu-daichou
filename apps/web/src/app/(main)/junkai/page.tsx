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
import { can, getCurrentRole } from '@/lib/auth';
import {
  listActiveUsersForAssignee,
  listCircuitTours,
} from '@/features/junkai/queries';
import {
  CIRCUIT_TOUR_STATUS_BADGE_VARIANT,
  CIRCUIT_TOUR_STATUS_LABELS,
  CIRCUIT_TOUR_TYPE_LABELS,
} from '@/features/junkai/types';

/** @db.Date (UTC0時保存) を JST 基準の YYYY/M/D で整形する (getUTC* で読む)。 */
function formatJstDate(d: Date): string {
  return `${d.getUTCFullYear()}/${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

export default async function JunkaiListPage() {
  const [tours, assignees, role] = await Promise.all([
    listCircuitTours({ scope: 'upcoming' }),
    listActiveUsersForAssignee(),
    getCurrentRole(),
  ]);
  const canCreate = role !== null && can(role, 'create');
  const assigneeNameById = new Map(assignees.map((a) => [a.id, a.name]));

  function assigneeName(id: string | null): string {
    if (id === null) return '（未割当）';
    return assigneeNameById.get(id) ?? '（不明）';
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="巡回"
        description="棚経・月参りなどの巡回予定を実施日昇順で表示しています。"
        breadcrumbs={[
          { label: 'ダッシュボード', href: '/dashboard' },
          { label: '巡回' },
        ]}
        actions={
          canCreate ? (
            <Link href="/junkai/new">
              <Button>巡回を登録</Button>
            </Link>
          ) : undefined
        }
      />

      {tours.length === 0 ? (
        <EmptyState
          title="今後の巡回予定はありません"
          description="「巡回を登録」から棚経・月参りの予定を追加してください。"
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{tours.length} 件</p>

          {/* PC: テーブル */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>予定日</TableHead>
                  <TableHead>巡回名</TableHead>
                  <TableHead>種別</TableHead>
                  <TableHead>担当者</TableHead>
                  <TableHead className="text-right">訪問先</TableHead>
                  <TableHead>状況</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tours.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{formatJstDate(t.scheduledDate)}</TableCell>
                    <TableCell className="font-medium">
                      <Link
                        href={`/junkai/${t.id}`}
                        className="text-foreground hover:underline"
                      >
                        {t.title}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="neutral">
                        {CIRCUIT_TOUR_TYPE_LABELS[t.tourType]}
                      </Badge>
                    </TableCell>
                    <TableCell>{assigneeName(t.assignedUserId)}</TableCell>
                    <TableCell className="text-right">
                      {t._count.stops} 件
                    </TableCell>
                    <TableCell>
                      <Badge variant={CIRCUIT_TOUR_STATUS_BADGE_VARIANT[t.status]}>
                        {CIRCUIT_TOUR_STATUS_LABELS[t.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/junkai/${t.id}`}>
                        <Button variant="secondary" size="sm">
                          詳細
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
            {tours.map((t) => (
              <li key={t.id}>
                <Card>
                  <CardContent className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <Link
                        href={`/junkai/${t.id}`}
                        className="text-lg font-medium text-foreground hover:underline"
                      >
                        {t.title}
                      </Link>
                      <Badge variant={CIRCUIT_TOUR_STATUS_BADGE_VARIANT[t.status]}>
                        {CIRCUIT_TOUR_STATUS_LABELS[t.status]}
                      </Badge>
                    </div>
                    <p className="text-sm text-foreground">
                      {formatJstDate(t.scheduledDate)} ・{' '}
                      {CIRCUIT_TOUR_TYPE_LABELS[t.tourType]}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      担当: {assigneeName(t.assignedUserId)} ・ 訪問先{' '}
                      {t._count.stops} 件
                    </p>
                    <div>
                      <Link href={`/junkai/${t.id}`}>
                        <Button variant="secondary" size="sm">
                          詳細
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="text-xs text-muted-foreground">
        ※ 一覧は本日以降の予定 (最大 100 件) を表示しています。
      </p>
    </div>
  );
}
