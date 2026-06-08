import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getGravePlotById } from '@/features/kukaku/queries';
import { listBurialCandidates } from '@/features/kukaku/burial-queries';
import { BurialForm } from '@/features/kukaku/BurialForm';

export default async function NewBurialPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const plot = await getGravePlotById(id);
  if (!plot) {
    notFound();
  }

  const candidates = await listBurialCandidates({
    preferredHouseholdId: plot.householdId,
  });

  const now = new Date();
  const defaultInterredAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

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
          <span className="text-foreground">納骨を記録</span>
        </nav>
        <h1 className="mt-2 text-2xl font-rounded tracking-wider">
          納骨を記録する
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          区画 {plot.plotNumber} に故人を納骨します。
        </p>
      </div>

      <div className="rounded border border-border bg-surface p-6">
        <BurialForm
          gravePlotId={plot.id}
          candidates={candidates}
          cancelHref={`/kukaku/${plot.id}`}
          defaultInterredAt={defaultInterredAt}
        />
      </div>
    </div>
  );
}
