import Link from 'next/link';
import { Button, EmptyState, PageHeader } from '@/components/ui';
import { listHouseholdsWithoutPlan } from '@/features/gojikai/queries';
import { PlanForm } from '@/features/gojikai/PlanForm';

export default async function NewFeePlanPage() {
  const households = await listHouseholdsWithoutPlan();

  return (
    <div className="space-y-6">
      <PageHeader
        title="会費台帳を追加"
        description="世帯を選び、年額会費と納入区分を登録します。"
        breadcrumbs={[
          { label: 'ダッシュボード', href: '/dashboard' },
          { label: '護持会費', href: '/gojikai' },
          { label: '会費台帳', href: '/gojikai/daichou' },
          { label: '追加' },
        ]}
      />

      {households.length === 0 ? (
        <EmptyState
          title="台帳を登録できる世帯がありません"
          description="すべての世帯に台帳が登録済みか、登録できる世帯がありません。世帯を先に登録してください。"
          action={
            <Link href="/danshintoto/new">
              <Button>世帯を登録</Button>
            </Link>
          }
        />
      ) : (
        <PlanForm mode="create" householdOptions={households} />
      )}
    </div>
  );
}
