import Link from 'next/link';
import {
  Badge,
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
import { listGravePlans } from '@/features/bochi/queries';
import { toggleGravePlanActiveAction } from '@/features/bochi/actions';
import { formatYen } from '@/features/bochi/format';
import { GRAVE_MAINTENANCE_METHOD_LABELS } from '@/lib/bochi';

export default async function GravePlanListPage() {
  const plans = await listGravePlans();
  const activeCount = plans.filter((p) => p.isActive).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="管理料台帳"
        description="区画ごとの年額管理料・賦課根拠・納入区分を登録します。年度請求はこの台帳から生成されます。"
        breadcrumbs={[
          { label: 'ダッシュボード', href: '/dashboard' },
          { label: '墓地管理料', href: '/bochi' },
          { label: '管理料台帳' },
        ]}
        actions={
          <Link href="/bochi/daichou/new">
            <Button>台帳を追加</Button>
          </Link>
        }
      />

      {plans.length === 0 ? (
        <EmptyState
          title="管理料台帳がまだありません"
          description="「台帳を追加」から、区画ごとの年額管理料を登録してください。"
          action={
            <Link href="/bochi/daichou/new">
              <Button>台帳を追加</Button>
            </Link>
          }
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            登録 {plans.length} 区画（うち有効 {activeCount} 区画）
          </p>

          {/* PC: テーブル */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>区画</TableHead>
                  <TableHead>契約世帯</TableHead>
                  <TableHead className="text-right">年額管理料</TableHead>
                  <TableHead>納入区分</TableHead>
                  <TableHead>状態</TableHead>
                  <TableHead>賦課根拠</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link
                        href={`/kukaku/${p.gravePlot.id}`}
                        className="text-info hover:underline"
                      >
                        区画 {p.gravePlot.plotNumber}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {p.gravePlot.household
                        ? `${p.gravePlot.household.householderName} 様`
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatYen(p.annualAmount)}
                    </TableCell>
                    <TableCell>
                      {GRAVE_MAINTENANCE_METHOD_LABELS[p.method]}
                    </TableCell>
                    <TableCell>
                      {p.isActive ? (
                        <Badge variant="success">有効</Badge>
                      ) : (
                        <Badge variant="neutral">休止</Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">
                      {p.basis ?? '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/bochi/daichou/${p.gravePlot.id}/edit`}>
                          <Button variant="secondary" size="sm">
                            編集
                          </Button>
                        </Link>
                        <form action={toggleGravePlanActiveAction}>
                          <input
                            type="hidden"
                            name="gravePlotId"
                            value={p.gravePlot.id}
                          />
                          <Button variant="ghost" size="sm" type="submit">
                            {p.isActive ? '休止にする' : '再開する'}
                          </Button>
                        </form>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* スマホ: カード */}
          <ul className="space-y-3 md:hidden">
            {plans.map((p) => (
              <li
                key={p.id}
                className="rounded-lg border border-border bg-surface p-4 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <Link
                    href={`/kukaku/${p.gravePlot.id}`}
                    className="font-medium text-info hover:underline"
                  >
                    区画 {p.gravePlot.plotNumber}
                  </Link>
                  {p.isActive ? (
                    <Badge variant="success">有効</Badge>
                  ) : (
                    <Badge variant="neutral">休止</Badge>
                  )}
                </div>
                {p.gravePlot.household && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {p.gravePlot.household.householderName} 様
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span className="text-foreground">
                    {formatYen(p.annualAmount)}
                  </span>
                  <span>{GRAVE_MAINTENANCE_METHOD_LABELS[p.method]}</span>
                </div>
                {p.basis && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    根拠: {p.basis}
                  </p>
                )}
                <div className="mt-3 flex items-center gap-2">
                  <Link href={`/bochi/daichou/${p.gravePlot.id}/edit`}>
                    <Button variant="secondary" size="sm">
                      編集
                    </Button>
                  </Link>
                  <form action={toggleGravePlanActiveAction}>
                    <input
                      type="hidden"
                      name="gravePlotId"
                      value={p.gravePlot.id}
                    />
                    <Button variant="ghost" size="sm" type="submit">
                      {p.isActive ? '休止にする' : '再開する'}
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
