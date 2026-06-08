import Link from 'next/link';
import { Button, EmptyState, PageHeader } from '@/components/ui';
import { listGravePlotsWithoutPlan } from '@/features/bochi/queries';
import { PlanForm } from '@/features/bochi/PlanForm';

export default async function NewGravePlanPage() {
  const plots = await listGravePlotsWithoutPlan();

  return (
    <div className="space-y-6">
      <PageHeader
        title="管理料台帳を追加"
        description="区画ごとの年額管理料を登録します。墓地管理料は区画単位で賦課します（護持会費の世帯単位とは別の台帳です）。"
        breadcrumbs={[
          { label: 'ダッシュボード', href: '/dashboard' },
          { label: '墓地管理料', href: '/bochi' },
          { label: '管理料台帳', href: '/bochi/daichou' },
          { label: '追加' },
        ]}
      />

      {plots.length === 0 ? (
        <EmptyState
          title="台帳を作成できる区画がありません"
          description="すべての区画に管理料台帳が登録済みか、登録対象の区画がありません。区画は区画管理から追加できます。"
          action={
            <Link href="/kukaku">
              <Button>区画管理へ</Button>
            </Link>
          }
        />
      ) : (
        <PlanForm
          mode="create"
          plotOptions={plots.map((p) => ({
            id: p.id,
            plotNumber: p.plotNumber,
            householderName: p.household?.householderName ?? null,
          }))}
        />
      )}
    </div>
  );
}
