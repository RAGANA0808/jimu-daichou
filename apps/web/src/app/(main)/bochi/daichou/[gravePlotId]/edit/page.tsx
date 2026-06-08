import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui';
import {
  getGravePlanByPlot,
  getGravePlotLiteById,
} from '@/features/bochi/queries';
import { PlanForm } from '@/features/bochi/PlanForm';

export default async function EditGravePlanPage({
  params,
}: {
  params: Promise<{ gravePlotId: string }>;
}) {
  const { gravePlotId } = await params;
  const [plan, plot] = await Promise.all([
    getGravePlanByPlot(gravePlotId),
    getGravePlotLiteById(gravePlotId),
  ]);
  if (!plan || !plot) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="管理料台帳を編集"
        description={`区画 ${plot.plotNumber} の年額管理料・賦課根拠を変更します。`}
        breadcrumbs={[
          { label: 'ダッシュボード', href: '/dashboard' },
          { label: '墓地管理料', href: '/bochi' },
          { label: '管理料台帳', href: '/bochi/daichou' },
          { label: `区画 ${plot.plotNumber}` },
        ]}
      />

      <PlanForm
        mode="edit"
        fixedPlot={{
          id: plot.id,
          plotNumber: plot.plotNumber,
          householderName: plot.household?.householderName ?? null,
        }}
        defaultValues={{
          annualAmount: String(plan.annualAmount),
          method: plan.method,
          basis: plan.basis ?? '',
          note: plan.note ?? '',
        }}
      />
    </div>
  );
}
