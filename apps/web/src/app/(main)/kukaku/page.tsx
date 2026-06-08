import Link from 'next/link';
import type { GravePlotStatus } from '@prisma/client';
import {
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
import { countGravePlotsByStatus, listGravePlots } from '@/features/kukaku/queries';
import { listKyoshiCandidates } from '@/features/kukaku/expiry-queries';
import {
  GRAVE_CONTRACT_TYPE_LABELS,
  GRAVE_PLOT_STATUS_LABELS,
  GRAVE_PLOT_STATUS_ORDER,
  GRAVE_PLOT_TYPE_LABELS,
} from '@/features/kukaku/types';
import { GravePlotStatusBadge } from '@/features/kukaku/StatusBadge';

function formatJaDateUtc(d: Date): string {
  return `${d.getUTCFullYear()}/${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

const STATUS_COUNT_KEYS: Record<
  GravePlotStatus,
  | 'available'
  | 'reserved'
  | 'inUse'
  | 'overdue'
  | 'unclaimed'
  | 'interredTogether'
  | 'closed'
> = {
  AVAILABLE: 'available',
  RESERVED: 'reserved',
  IN_USE: 'inUse',
  OVERDUE: 'overdue',
  UNCLAIMED: 'unclaimed',
  INTERRED_TOGETHER: 'interredTogether',
  CLOSED: 'closed',
};

function parseStatusFilter(raw: string | undefined): GravePlotStatus | null {
  if (!raw) return null;
  return GRAVE_PLOT_STATUS_ORDER.includes(raw as GravePlotStatus)
    ? (raw as GravePlotStatus)
    : null;
}

export default async function KukakuListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; expiry?: string }>;
}) {
  const { status: rawStatus, expiry: rawExpiry } = await searchParams;
  const expirySoon = rawExpiry === 'soon';
  // expiry フィルタは契約由来 (軸が違う) ので status とは排他にする。
  const activeStatus = expirySoon ? null : parseStatusFilter(rawStatus);

  const [plots, counts, kyoshiCandidates] = await Promise.all([
    expirySoon
      ? Promise.resolve([])
      : listGravePlots(activeStatus ? { status: activeStatus } : undefined),
    countGravePlotsByStatus(),
    listKyoshiCandidates({ withinMonths: 12 }),
  ]);
  const kyoshiCount = kyoshiCandidates.length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="区画"
        description="墓地区画の一覧です。区画番号順に表示しています。"
        breadcrumbs={[
          { label: 'ダッシュボード', href: '/dashboard' },
          { label: '区画' },
        ]}
        actions={
          <>
            <Link href="/kukaku/areas">
              <Button variant="secondary">エリア管理</Button>
            </Link>
            <Link href="/kukaku/map">
              <Button variant="secondary">地図で見る</Button>
            </Link>
            <Link href="/kukaku/new">
              <Button>＋ 新規登録</Button>
            </Link>
          </>
        }
      />

      {counts.total > 0 && (
        <nav
          aria-label="状態で絞り込み"
          className="flex flex-wrap items-center gap-2"
        >
          <FilterChip
            href="/kukaku"
            label="すべて"
            count={counts.total}
            active={activeStatus === null && !expirySoon}
          />
          {GRAVE_PLOT_STATUS_ORDER.map((s) => (
            <FilterChip
              key={s}
              href={`/kukaku?status=${s}`}
              label={GRAVE_PLOT_STATUS_LABELS[s]}
              count={counts[STATUS_COUNT_KEYS[s]]}
              active={activeStatus === s}
              status={s}
            />
          ))}
          {kyoshiCount > 0 && (
            <FilterChip
              href="/kukaku?expiry=soon"
              label="合祀移行間近"
              count={kyoshiCount}
              active={expirySoon}
            />
          )}
        </nav>
      )}

      {expirySoon ? (
        kyoshiCount === 0 ? (
          <EmptyState
            title="合祀移行が間近の区画はありません"
            description="満了日 (合祀期限) が近づくと、こちらに表示されます。"
          />
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              合祀移行間近 {kyoshiCount} 件（満了日の近い順）
            </p>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>区画番号</TableHead>
                    <TableHead>契約種別</TableHead>
                    <TableHead>使用世帯</TableHead>
                    <TableHead>満了日 (合祀期限)</TableHead>
                    <TableHead>残月</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kyoshiCandidates.map((c) => (
                    <TableRow key={c.contractId}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/kukaku/${c.gravePlotId}`}
                          className="text-foreground hover:underline"
                        >
                          {c.plotNumber}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {GRAVE_CONTRACT_TYPE_LABELS[c.contractType]}
                      </TableCell>
                      <TableCell>
                        {c.household ? (
                          <Link
                            href={`/danshintoto/${c.household.id}`}
                            className="text-info hover:underline"
                          >
                            {c.household.householderName}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">
                            契約世帯 未設定
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{formatJaDateUtc(c.expiryDate)}</TableCell>
                      <TableCell>
                        {c.monthsLeft < 0 ? (
                          <span className="font-medium text-danger">満了済</span>
                        ) : (
                          <span
                            className={
                              c.monthsLeft <= 3
                                ? 'font-medium text-warning'
                                : 'text-foreground'
                            }
                          >
                            約 {c.monthsLeft} ヶ月
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )
      ) : counts.total === 0 ? (
        <EmptyState
          title="区画はまだ登録されていません"
          description="右上の「＋ 新規登録」から追加してください。"
        />
      ) : plots.length === 0 ? (
        <EmptyState
          title="該当する区画がありません"
          description="絞り込み条件を変えるか、「すべて」を選択してください。"
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {activeStatus
              ? `${GRAVE_PLOT_STATUS_LABELS[activeStatus]} ${plots.length} 件`
              : `${plots.length} 件`}
          </p>

          {/* PC: テーブル */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>区画番号</TableHead>
                  <TableHead>種別</TableHead>
                  <TableHead>状態</TableHead>
                  <TableHead>エリア</TableHead>
                  <TableHead>契約世帯</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plots.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/kukaku/${p.id}`}
                        className="text-foreground hover:underline"
                      >
                        {p.plotNumber}
                      </Link>
                    </TableCell>
                    <TableCell>{GRAVE_PLOT_TYPE_LABELS[p.plotType]}</TableCell>
                    <TableCell>
                      <GravePlotStatusBadge status={p.status} />
                    </TableCell>
                    <TableCell>
                      {p.area ? (
                        p.area.name
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {p.household ? (
                        <Link
                          href={`/danshintoto/${p.household.id}`}
                          className="text-info hover:underline"
                        >
                          {p.household.householderName}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/kukaku/${p.id}/edit`}>
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
            {plots.map((p) => (
              <li key={p.id}>
                <Card>
                  <CardContent className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <Link
                        href={`/kukaku/${p.id}`}
                        className="text-lg font-medium text-foreground hover:underline"
                      >
                        {p.plotNumber}
                      </Link>
                      <GravePlotStatusBadge status={p.status} />
                    </div>
                    <p className="text-sm text-foreground">
                      {GRAVE_PLOT_TYPE_LABELS[p.plotType]}
                      {p.area && (
                        <span className="text-muted-foreground">
                          {' '}
                          / {p.area.name}
                        </span>
                      )}
                    </p>
                    {p.household ? (
                      <Link
                        href={`/danshintoto/${p.household.id}`}
                        className="inline-block text-sm text-info hover:underline"
                      >
                        {p.household.householderName}
                      </Link>
                    ) : (
                      <p className="text-sm text-muted-foreground">契約世帯なし</p>
                    )}
                    <div>
                      <Link href={`/kukaku/${p.id}/edit`}>
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
    </div>
  );
}

function FilterChip({
  href,
  label,
  count,
  active,
  status,
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
  status?: GravePlotStatus;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={[
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors',
        active
          ? 'border-brand bg-brand/10 font-medium text-foreground'
          : 'border-border bg-surface text-muted-foreground hover:bg-muted',
      ].join(' ')}
    >
      {status ? (
        <GravePlotStatusBadge status={status} className="border-0 bg-transparent px-0" />
      ) : (
        <span>{label}</span>
      )}
      <span className="tabular-nums font-medium text-foreground">{count}</span>
    </Link>
  );
}
