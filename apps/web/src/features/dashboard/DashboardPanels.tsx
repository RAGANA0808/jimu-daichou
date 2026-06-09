import Link from 'next/link';
import {
  Badge,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  EmptyState,
} from '@/components/ui';
import { INTERACTION_KIND_BADGE_VARIANT, INTERACTION_KIND_LABELS } from '@/features/danshintoto/interaction-types';
import type { DashboardData } from './queries';
import {
  formatJaDateTime,
  formatJaDateUtc,
  formatJaMonthDay,
  formatYen,
} from './format';

export function UpcomingServicesPanel({
  services,
}: {
  services: DashboardData['services'];
}) {
  const shown = services.thisMonth.slice(0, 5);
  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CardTitle>今後の法要</CardTitle>
          {services.thisMonth.length > 0 && (
            <Badge variant="brand">{services.thisMonth.length} 件</Badge>
          )}
        </div>
        <Link href="/houyou" className="text-sm text-info hover:underline">
          一覧
        </Link>
      </CardHeader>
      <CardContent className="flex-1">
        {services.thisMonth.length === 0 ? (
          <EmptyState
            title="今月のご予定はありません"
            description="法要をご登録いただくと、こちらに表示されます。"
          />
        ) : (
          <ul className="divide-y divide-border">
            {shown.map((s) => {
              const isToday = services.today.some((t) => t.id === s.id);
              return (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">
                      {s.serviceName}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {s.household.householderName} 家
                      {s.location ? ` ・ ${s.location}` : ''}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    {isToday && (
                      <Badge variant="warning" className="mb-1">
                        本日
                      </Badge>
                    )}
                    <p className="text-sm text-muted-foreground">
                      {formatJaDateTime(s.scheduledAt)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
      {services.thisMonth.length > shown.length && (
        <CardFooter className="py-2.5">
          <Link href="/houyou" className="text-sm font-medium text-info hover:underline">
            すべて見る（{services.thisMonth.length} 件）
          </Link>
        </CardFooter>
      )}
    </Card>
  );
}

export function UpcomingAnniversariesPanel({
  anniversaries,
}: {
  anniversaries: DashboardData['upcomingAnniversaries'];
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CardTitle>直近の年忌</CardTitle>
          {anniversaries.length > 0 && (
            <Badge variant="brand">{anniversaries.length} 件</Badge>
          )}
        </div>
        <Link href="/nenki" className="text-sm text-info hover:underline">
          年忌表
        </Link>
      </CardHeader>
      <CardContent className="flex-1">
        {anniversaries.length === 0 ? (
          <EmptyState
            title="本日以降の年忌はありません"
            description="本年に予定日を迎える年忌は、年忌表でご確認いただけます。"
          />
        ) : (
          <ul className="divide-y divide-border">
            {anniversaries.map((a) => (
              <li
                key={a.entryId}
                className="flex items-center justify-between gap-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">
                    {a.secularName}
                    {a.kaimyoName ? (
                      <span className="ml-2 text-sm text-muted-foreground">
                        {a.kaimyoName}
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {a.householdName} 家 ・ {a.anniversary.name}
                  </p>
                </div>
                <div className="shrink-0 text-right text-sm text-muted-foreground">
                  {a.anniversary.month !== null && a.anniversary.day !== null
                    ? formatJaMonthDay(
                        new Date(
                          a.anniversary.year,
                          a.anniversary.month - 1,
                          a.anniversary.day,
                        ),
                      )
                    : '日付未定'}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      {anniversaries.length > 0 && (
        <CardFooter className="py-2.5">
          <Link href="/nenki" className="text-sm font-medium text-info hover:underline">
            年忌表ですべて見る
          </Link>
        </CardFooter>
      )}
    </Card>
  );
}

export function RecentInteractionsPanel({
  notes,
}: {
  notes: DashboardData['recentInteractions'];
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CardTitle>最近の対応履歴</CardTitle>
          {notes.length > 0 && <Badge variant="brand">{notes.length} 件</Badge>}
        </div>
        <Link href="/danshintoto" className="text-sm text-info hover:underline">
          檀信徒カルテ
        </Link>
      </CardHeader>
      <CardContent>
        {notes.length === 0 ? (
          <EmptyState
            title="対応履歴はまだありません"
            description="お電話・ご訪問などの記録を残すと、こちらに新しい順で表示されます。"
          />
        ) : (
          <ol className="divide-y divide-border">
            {notes.map((n) => (
              <li key={n.id} className="py-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Badge variant={INTERACTION_KIND_BADGE_VARIANT[n.kind]}>
                      {INTERACTION_KIND_LABELS[n.kind]}
                    </Badge>
                    <Link
                      href={`/danshintoto/${n.household.id}`}
                      className="text-sm font-medium text-foreground hover:underline"
                    >
                      {n.household.householderName} 家
                    </Link>
                  </div>
                  <span className="shrink-0 text-sm text-muted-foreground">
                    {formatJaDateTime(n.occurredAt)}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {n.content}
                </p>
                {n.authorName && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    記録者: {n.authorName}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

export function KyoshiCandidatesPanel({
  kyoshi,
}: {
  kyoshi: DashboardData['kyoshi'];
}) {
  const shown = kyoshi.top;
  // 満了済 (monthsLeft < 0) が 1 件でもあれば警告寄り。
  const hasOverdue = shown.some((c) => c.monthsLeft < 0);

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CardTitle>合祀移行のお知らせ</CardTitle>
          {kyoshi.count > 0 ? (
            <Badge variant={hasOverdue ? 'danger' : 'warning'}>
              {kyoshi.count} 件
            </Badge>
          ) : (
            <Badge variant="success">なし</Badge>
          )}
        </div>
        <Link
          href="/kukaku?expiry=soon"
          className="text-sm text-info hover:underline"
        >
          区画一覧
        </Link>
      </CardHeader>
      <CardContent className="flex-1">
        {kyoshi.count === 0 ? (
          <EmptyState
            title="合祀移行が間近の区画はありません"
            description="満了日 (合祀期限) が近づくと、こちらでお知らせします。"
          />
        ) : (
          <ul className="divide-y divide-border">
            {shown.map((c) => {
              const overdue = c.monthsLeft < 0;
              const soon = c.monthsLeft >= 0 && c.monthsLeft <= 3;
              return (
                <li
                  key={c.contractId}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/kukaku/${c.gravePlotId}`}
                      className="truncate font-medium text-foreground hover:underline"
                    >
                      区画 {c.plotNumber}
                    </Link>
                    <p className="truncate text-sm text-muted-foreground">
                      {c.household
                        ? `${c.household.householderName} 家`
                        : '契約世帯 未設定'}
                      {' ・ '}
                      {formatJaDateUtc(c.expiryDate)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right text-sm">
                    {overdue ? (
                      <span className="font-medium text-danger">満了済</span>
                    ) : (
                      <span
                        className={
                          soon
                            ? 'font-medium text-warning'
                            : 'text-muted-foreground'
                        }
                      >
                        残り約 {c.monthsLeft} ヶ月
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
      {kyoshi.count > shown.length && (
        <CardFooter className="py-2.5">
          <Link
            href="/kukaku?expiry=soon"
            className="text-sm font-medium text-info hover:underline"
          >
            合祀候補をすべて見る（{kyoshi.count} 件）
          </Link>
        </CardFooter>
      )}
    </Card>
  );
}

export function OutstandingPanel({
  outstanding,
}: {
  outstanding: DashboardData['outstanding'];
}) {
  const { gojikai, bochi, fiscalYear } = outstanding;
  const totalCount = gojikai.count + bochi.count;

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CardTitle>未収のお知らせ</CardTitle>
          {totalCount > 0 ? (
            <Badge variant="warning">{totalCount} 件</Badge>
          ) : (
            <Badge variant="success">なし</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-4">
        {totalCount === 0 ? (
          <EmptyState
            title="未収はありません"
            description="護持会費・墓地管理料とも、未収の世帯・区画はありません。"
          />
        ) : (
          <>
            <section>
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-foreground">
                  護持会費
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({fiscalYear} 年度)
                  </span>
                </p>
                <p className="text-sm text-muted-foreground">
                  {gojikai.count} 件 ・{' '}
                  <span className="font-medium text-warning">
                    {formatYen(gojikai.total)}
                  </span>
                </p>
              </div>
              {gojikai.count === 0 ? (
                <p className="mt-1 text-sm text-muted-foreground">未収はありません。</p>
              ) : (
                <ul className="mt-1 divide-y divide-border">
                  {gojikai.top.map((c) => (
                    <li
                      key={c.invoiceId}
                      className="flex items-center justify-between gap-3 py-2"
                    >
                      <Link
                        href={`/danshintoto/${c.householdId}`}
                        className="truncate text-sm font-medium text-foreground hover:underline"
                      >
                        {c.householderName} 家
                      </Link>
                      <span className="shrink-0 text-sm text-muted-foreground">
                        {formatYen(c.outstanding)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-foreground">
                  墓地管理料
                  <span className="ml-1 text-xs text-muted-foreground">
                    (累積)
                  </span>
                </p>
                <p className="text-sm text-muted-foreground">
                  {bochi.count} 件 ・{' '}
                  <span className="font-medium text-warning">
                    {formatYen(bochi.total)}
                  </span>
                </p>
              </div>
              {bochi.count === 0 ? (
                <p className="mt-1 text-sm text-muted-foreground">滞納はありません。</p>
              ) : (
                <ul className="mt-1 divide-y divide-border">
                  {bochi.top.map((c) => (
                    <li
                      key={c.gravePlotId}
                      className="flex items-center justify-between gap-3 py-2"
                    >
                      <span className="min-w-0 truncate text-sm font-medium text-foreground">
                        {c.householderName
                          ? `${c.householderName} 家`
                          : '契約世帯 未設定'}
                        <span className="ml-1 text-xs text-muted-foreground">
                          区画 {c.plotNumber}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm text-muted-foreground">
                        {formatYen(c.totalOutstanding)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </CardContent>
      <CardFooter className="gap-4 py-2.5">
        <Link href="/gojikai" className="text-sm font-medium text-info hover:underline">
          護持会費へ
        </Link>
        <Link href="/bochi" className="text-sm font-medium text-info hover:underline">
          墓地管理料へ
        </Link>
      </CardFooter>
    </Card>
  );
}
