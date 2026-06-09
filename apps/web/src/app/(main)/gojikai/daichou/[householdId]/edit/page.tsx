import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui';
import { getHouseholdById } from '@/features/danshintoto/queries';
import { getFeePlanByHousehold } from '@/features/gojikai/queries';
import { PlanForm } from '@/features/gojikai/PlanForm';

export default async function EditFeePlanPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const [household, plan] = await Promise.all([
    getHouseholdById(householdId),
    getFeePlanByHousehold(householdId),
  ]);
  if (!household || !plan) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="会費台帳を編集"
        description={`${household.householderName} 様の年額会費・納入区分を変更します。`}
        breadcrumbs={[
          { label: 'ダッシュボード', href: '/dashboard' },
          { label: '護持会費', href: '/gojikai' },
          { label: '会費台帳', href: '/gojikai/daichou' },
          { label: household.householderName },
        ]}
      />

      <PlanForm
        mode="edit"
        fixedHousehold={{
          id: household.id,
          householderName: household.householderName,
        }}
        defaultValues={{
          annualAmount: String(plan.annualAmount),
          method: plan.method,
          note: plan.note ?? '',
        }}
      />
    </div>
  );
}
