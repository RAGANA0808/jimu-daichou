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
import { listFeePlans } from '@/features/gojikai/queries';
import { toggleFeePlanActiveAction } from '@/features/gojikai/actions';
import { formatYen } from '@/features/gojikai/format';
import { MAINTENANCE_FEE_METHOD_LABELS } from '@/lib/gojikai';

export default async function FeePlanListPage() {
  const plans = await listFeePlans();
  const activeCount = plans.filter((p) => p.isActive).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="会費台帳"
        description="世帯ごとの年額会費・納入区分を登録します。年度請求はこの台帳から生成されます。"
        breadcrumbs={[
          { label: 'ダッシュボード', href: '/dashboard' },
          { label: '護持会費', href: '/gojikai' },
          { label: '会費台帳' },
        ]}
        actions={
          <Link href="/gojikai/daichou/new">
            <Button>台帳を追加</Button>
          </Link>
        }
      />

      {plans.length === 0 ? (
        <EmptyState
          title="会費台帳がまだありません"
          description="「台帳を追加」から、世帯ごとの年額会費を登録してください。"
          action={
            <Link href="/gojikai/daichou/new">
              <Button>台帳を追加</Button>
            </Link>
          }
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            登録 {plans.length} 世帯（うち有効 {activeCount} 世帯）
          </p>

          {/* PC: テーブル */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>世帯</TableHead>
                  <TableHead className="text-right">年額会費</TableHead>
                  <TableHead>納入区分</TableHead>
                  <TableHead>状態</TableHead>
                  <TableHead>備考</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link
                        href={`/danshintoto/${p.household.id}`}
                        className="text-info hover:underline"
                      >
                        {p.household.householderName} 様
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatYen(p.annualAmount)}
                    </TableCell>
                    <TableCell>
                      {MAINTENANCE_FEE_METHOD_LABELS[p.method]}
                    </TableCell>
                    <TableCell>
                      {p.isActive ? (
                        <Badge variant="success">有効</Badge>
                      ) : (
                        <Badge variant="neutral">休止</Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">
                      {p.note ?? '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/gojikai/daichou/${p.household.id}/edit`}
                        >
                          <Button variant="secondary" size="sm">
                            編集
                          </Button>
                        </Link>
                        <form action={toggleFeePlanActiveAction}>
                          <input
                            type="hidden"
                            name="householdId"
                            value={p.household.id}
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
                    href={`/danshintoto/${p.household.id}`}
                    className="font-medium text-info hover:underline"
                  >
                    {p.household.householderName} 様
                  </Link>
                  {p.isActive ? (
                    <Badge variant="success">有効</Badge>
                  ) : (
                    <Badge variant="neutral">休止</Badge>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span className="text-foreground">
                    {formatYen(p.annualAmount)}
                  </span>
                  <span>{MAINTENANCE_FEE_METHOD_LABELS[p.method]}</span>
                </div>
                {p.note && (
                  <p className="mt-1 text-sm text-muted-foreground">{p.note}</p>
                )}
                <div className="mt-3 flex items-center gap-2">
                  <Link href={`/gojikai/daichou/${p.household.id}/edit`}>
                    <Button variant="secondary" size="sm">
                      編集
                    </Button>
                  </Link>
                  <form action={toggleFeePlanActiveAction}>
                    <input
                      type="hidden"
                      name="householdId"
                      value={p.household.id}
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
