import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getGravePlotById,
  listHouseholdsForSelect,
} from '@/features/kukaku/queries';
import { createGraveContractAction } from '@/features/kukaku/contract-actions';
import { GraveContractForm } from '@/features/kukaku/GraveContractForm';

export default async function NewGraveContractPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [plot, householdOptions] = await Promise.all([
    getGravePlotById(id),
    listHouseholdsForSelect(),
  ]);
  if (!plot) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <nav className="text-sm text-muted-foreground">
          <Link href="/kukaku" className="hover:underline">
            区画
          </Link>
          <span className="mx-2">/</span>
          <Link href={`/kukaku/${plot.id}`} className="hover:underline">
            {plot.plotNumber}
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">契約を登録</span>
        </nav>
        <h1 className="mt-2 text-2xl font-rounded tracking-wider">
          契約を登録する
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          区画 {plot.plotNumber} の契約条件を登録します。
        </p>
      </div>

      <div className="rounded border border-border bg-surface p-6">
        <GraveContractForm
          action={createGraveContractAction}
          submitLabel="契約を登録する"
          cancelHref={`/kukaku/${plot.id}`}
          gravePlotId={plot.id}
          householdOptions={householdOptions}
          initialValues={{
            householdId: plot.householdId ?? '',
          }}
        />
      </div>
    </div>
  );
}
