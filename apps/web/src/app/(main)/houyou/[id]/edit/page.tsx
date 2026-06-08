import Link from 'next/link';
import { notFound } from 'next/navigation';
import { updateMemorialServiceAction } from '@/features/houyou/actions';
import { MemorialServiceForm } from '@/features/houyou/MemorialServiceForm';
import { getMemorialServiceById } from '@/features/houyou/queries';
import { toOptimisticToken } from '@/lib/db';

function toDatetimeLocalString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

export default async function EditMemorialServicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const service = await getMemorialServiceById(id);
  if (!service) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <nav className="text-sm text-muted-foreground">
          <Link href="/dashboard" className="hover:underline">
            ダッシュボード
          </Link>
          <span className="mx-2">/</span>
          <Link href="/houyou" className="hover:underline">
            法要
          </Link>
          <span className="mx-2">/</span>
          <Link href={`/houyou/${service.id}`} className="hover:underline">
            {service.serviceName}
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">編集</span>
        </nav>
        <h1 className="mt-2 text-2xl font-rounded tracking-wider">
          法要を編集する
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {service.household.householderName} 家 — {service.serviceName}
        </p>
      </div>

      <div className="rounded border border-border bg-surface p-6">
        <MemorialServiceForm
          action={updateMemorialServiceAction}
          submitLabel="保存する"
          memorialServiceId={service.id}
          cancelHref={`/houyou/${service.id}`}
          expectedUpdatedAt={toOptimisticToken(service.updatedAt)}
          initialValues={{
            serviceName: service.serviceName,
            scheduledAt: toDatetimeLocalString(service.scheduledAt),
            endTime: service.endTime ? toDatetimeLocalString(service.endTime) : '',
            location: service.location ?? '',
            attendeeCount: service.attendeeCount?.toString() ?? '',
            tobaCount: service.tobaCount?.toString() ?? '',
            offeringAmount: service.offeringAmount?.toString() ?? '',
            preparationStatus: service.preparationStatus,
            memo: service.memo ?? '',
          }}
        />
      </div>
    </div>
  );
}
