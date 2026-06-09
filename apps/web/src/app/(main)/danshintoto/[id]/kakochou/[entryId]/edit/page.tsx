import Link from 'next/link';
import { notFound } from 'next/navigation';
import { updateDeathLedgerEntryAction } from '@/features/kakochou/actions';
import { DeathLedgerEntryForm } from '@/features/kakochou/DeathLedgerEntryForm';
import { getDeathLedgerEntryById } from '@/features/kakochou/queries';
import { getHouseholdById } from '@/features/danshintoto/queries';
import { toOptimisticToken } from '@/lib/db';

export default async function EditDeathLedgerEntryPage({
  params,
}: {
  params: Promise<{ id: string; entryId: string }>;
}) {
  const { id, entryId } = await params;
  const [household, entry] = await Promise.all([
    getHouseholdById(id),
    getDeathLedgerEntryById(entryId),
  ]);

  if (!household || !entry) {
    notFound();
  }

  // URL の世帯 ID とエントリの person.householdId が食い違う場合も 404 扱い
  if (entry.person.householdId !== household.id) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <nav className="text-sm text-muted-foreground">
          <Link href="/danshintoto" className="hover:underline">
            檀信徒カルテ
          </Link>
          <span className="mx-2">/</span>
          <Link
            href={`/danshintoto/${household.id}`}
            className="hover:underline"
          >
            {household.householderName}
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">過去帳編集</span>
        </nav>
        <h1 className="mt-2 text-2xl font-rounded tracking-wider">
          過去帳エントリを編集する
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {entry.secularName} さんの記録を編集します。
        </p>
      </div>

      <div className="rounded border border-border bg-surface p-6">
        <DeathLedgerEntryForm
          action={updateDeathLedgerEntryAction}
          submitLabel="保存する"
          entryId={entry.id}
          cancelHref={`/danshintoto/${household.id}`}
          expectedUpdatedAt={toOptimisticToken(entry.updatedAt)}
          initialValues={{
            secularName: entry.secularName,
            nameKana: entry.person.nameKana,
            kaimyoName: entry.kaimyoName ?? '',
            deathYear: entry.deathYear?.toString() ?? '',
            deathMonth: entry.deathMonth?.toString() ?? '',
            deathDay: entry.deathDay?.toString() ?? '',
            ageAtDeath: entry.ageAtDeath?.toString() ?? '',
            familyRelation: entry.person.familyRelation ?? '',
            burialLocation: entry.burialLocation ?? '',
            memorialCutoffAnniversary:
              entry.memorialCutoffAnniversary?.toString() ?? '',
            memo: entry.memo ?? '',
          }}
        />
      </div>
    </div>
  );
}
