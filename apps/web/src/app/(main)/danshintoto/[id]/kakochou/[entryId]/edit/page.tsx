import Link from 'next/link';
import { notFound } from 'next/navigation';
import { updateDeathLedgerEntryAction } from '@/features/kakochou/actions';
import { DeathLedgerEntryForm } from '@/features/kakochou/DeathLedgerEntryForm';
import { getDeathLedgerEntryById } from '@/features/kakochou/queries';
import { getHouseholdById } from '@/features/danshintoto/queries';

function toIsoDate(d: Date): string {
  // YYYY-MM-DD (UTC ベースで保存されているが、Date フィールドは JST 相当の月日をそのまま使う想定)
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

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
        <nav className="text-sm text-gray-500">
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
          <span className="text-gray-700">過去帳編集</span>
        </nav>
        <h1 className="mt-2 text-2xl font-serif tracking-wider">
          過去帳エントリを編集する
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          {entry.secularName} さんの記録を編集します。
        </p>
      </div>

      <div className="rounded border border-gray-200 bg-white p-6">
        <DeathLedgerEntryForm
          action={updateDeathLedgerEntryAction}
          submitLabel="保存する"
          entryId={entry.id}
          cancelHref={`/danshintoto/${household.id}`}
          initialValues={{
            secularName: entry.secularName,
            nameKana: entry.person.nameKana,
            kaimyoName: entry.kaimyoName ?? '',
            dateOfDeath: toIsoDate(entry.dateOfDeath),
            ageAtDeath: entry.ageAtDeath?.toString() ?? '',
            familyRelation: entry.person.familyRelation ?? '',
            burialLocation: entry.burialLocation ?? '',
            memo: entry.memo ?? '',
          }}
        />
      </div>
    </div>
  );
}
