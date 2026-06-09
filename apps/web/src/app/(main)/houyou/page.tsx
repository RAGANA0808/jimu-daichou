import Link from 'next/link';
import type { PreparationStatus } from '@prisma/client';
import {
  Badge,
  type BadgeProps,
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
import { PREPARATION_STATUS_LABELS } from '@/features/houyou/types';
import { listUpcomingMemorialServices } from '@/features/houyou/queries';
import { listTempleEvents } from '@/features/gyouji/queries';

function formatJstDateTime(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}/${m}/${day} ${hh}:${mm}`;
}

/** 予定日時に終了時刻を併記する (同日なら "〜HH:mm"、別日なら開始のみ)。 */
function formatSchedule(scheduledAt: Date, endTime: Date | null): string {
  const base = formatJstDateTime(scheduledAt);
  if (endTime === null) return base;
  const sameDay =
    scheduledAt.getFullYear() === endTime.getFullYear() &&
    scheduledAt.getMonth() === endTime.getMonth() &&
    scheduledAt.getDate() === endTime.getDate();
  if (!sameDay) return base;
  const hh = String(endTime.getHours()).padStart(2, '0');
  const mm = String(endTime.getMinutes()).padStart(2, '0');
  return `${base} 〜 ${hh}:${mm}`;
}

const STATUS_BADGE_VARIANT: Record<PreparationStatus, BadgeProps['variant']> = {
  TENTATIVE: 'neutral',
  CONFIRMED: 'info',
  DONE: 'success',
  CANCELED: 'danger',
};

export default async function HouyouListPage() {
  const [services, templeEvents] = await Promise.all([
    listUpcomingMemorialServices(),
    listTempleEvents({ scope: 'upcoming' }),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="法要"
        description="今日以降の法要予定を日時昇順で表示しています。"
        breadcrumbs={[
          { label: 'ダッシュボード', href: '/dashboard' },
          { label: '法要' },
        ]}
      />

      {services.length === 0 ? (
        <EmptyState
          title="今後の法要予定はありません"
          description="世帯詳細から「＋ 法要を登録」で追加してください。"
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{services.length} 件</p>

          {/* PC: テーブル */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>予定日時</TableHead>
                  <TableHead>世帯 (施主)</TableHead>
                  <TableHead>法要名</TableHead>
                  <TableHead>場所</TableHead>
                  <TableHead>状況</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{formatSchedule(s.scheduledAt, s.endTime)}</TableCell>
                    <TableCell>
                      <Link
                        href={`/danshintoto/${s.household.id}`}
                        className="text-info hover:underline"
                      >
                        {s.household.householderName}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link
                        href={`/houyou/${s.id}`}
                        className="text-foreground hover:underline"
                      >
                        {s.serviceName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {s.location ?? (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_BADGE_VARIANT[s.preparationStatus]}>
                        {PREPARATION_STATUS_LABELS[s.preparationStatus]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/houyou/${s.id}/edit`}>
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
            {services.map((s) => (
              <li key={s.id}>
                <Card>
                  <CardContent className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <Link
                        href={`/houyou/${s.id}`}
                        className="text-lg font-medium text-foreground hover:underline"
                      >
                        {s.serviceName}
                      </Link>
                      <Badge variant={STATUS_BADGE_VARIANT[s.preparationStatus]}>
                        {PREPARATION_STATUS_LABELS[s.preparationStatus]}
                      </Badge>
                    </div>
                    <p className="text-sm text-foreground">
                      {formatSchedule(s.scheduledAt, s.endTime)}
                    </p>
                    <Link
                      href={`/danshintoto/${s.household.id}`}
                      className="inline-block text-sm text-info hover:underline"
                    >
                      {s.household.householderName}
                    </Link>
                    {s.location && (
                      <p className="text-sm text-muted-foreground">
                        場所: {s.location}
                      </p>
                    )}
                    <div>
                      <Link href={`/houyou/${s.id}/edit`}>
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
      )}

      {/* 寺の行事 (N-8): 世帯に紐づかない年中行事。法要一覧の有無に関わらず常時表示する。 */}
      <section className="space-y-4 border-t border-border pt-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium text-foreground">寺の行事</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              今日以降の寺の年中行事です。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/houyou/torikomi">
              <Button variant="secondary">カレンダーから取り込む</Button>
            </Link>
            <Link href="/houyou/gyouji/new">
              <Button>行事を登録</Button>
            </Link>
          </div>
        </div>

        {templeEvents.length === 0 ? (
          <EmptyState
            title="今後の寺の行事はありません"
            description="「行事を登録」から追加してください。"
          />
        ) : (
          <>
            {/* PC: テーブル */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>予定日時</TableHead>
                    <TableHead>行事名</TableHead>
                    <TableHead>場所</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templeEvents.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>
                        {formatSchedule(e.scheduledAt, e.endTime)}
                      </TableCell>
                      <TableCell className="font-medium">
                        <Link
                          href={`/houyou/gyouji/${e.id}/edit`}
                          className="text-foreground hover:underline"
                        >
                          {e.title}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {e.location ?? (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/houyou/gyouji/${e.id}/edit`}>
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
              {templeEvents.map((e) => (
                <li key={e.id}>
                  <Card>
                    <CardContent className="space-y-2">
                      <Link
                        href={`/houyou/gyouji/${e.id}/edit`}
                        className="text-lg font-medium text-foreground hover:underline"
                      >
                        {e.title}
                      </Link>
                      <p className="text-sm text-foreground">
                        {formatSchedule(e.scheduledAt, e.endTime)}
                      </p>
                      {e.location && (
                        <p className="text-sm text-muted-foreground">
                          場所: {e.location}
                        </p>
                      )}
                      <div>
                        <Link href={`/houyou/gyouji/${e.id}/edit`}>
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
        )}
      </section>

      <p className="text-xs text-muted-foreground">
        ※ 一覧は最大 100 件 (本日以降)。過去の法要履歴は世帯詳細の法要セクションでご確認ください。
      </p>
    </div>
  );
}
