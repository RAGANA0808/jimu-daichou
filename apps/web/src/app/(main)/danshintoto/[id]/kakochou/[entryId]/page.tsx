import Link from 'next/link';
import { notFound } from 'next/navigation';
import { allAnniversariesOf, type Anniversary } from '@/lib/nenki';
import { getHouseholdById } from '@/features/danshintoto/queries';
import { getDeathLedgerEntryById } from '@/features/kakochou/queries';
import { SoftDeleteEntryButton } from '@/features/kakochou/SoftDeleteEntryButton';

type AnniversaryStatus = 'past' | 'current' | 'future';

function statusOf(year: number, currentYear: number): AnniversaryStatus {
  if (year < currentYear) return 'past';
  if (year === currentYear) return 'current';
  return 'future';
}

function statusLabel(status: AnniversaryStatus): string {
  switch (status) {
    case 'past':
      return '済';
    case 'current':
      return '今年';
    case 'future':
      return '未来';
  }
}

function statusClass(status: AnniversaryStatus): string {
  switch (status) {
    case 'past':
      return 'bg-gray-100 text-gray-500';
    case 'current':
      return 'bg-amber-100 text-amber-800 font-medium';
    case 'future':
      return 'bg-white text-gray-900';
  }
}

function formatSchedule(
  month: number | null,
  day: number | null,
): string {
  if (month === null || day === null) return '月日不明';
  return `${month}月${day}日`;
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <>
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-900">
        {value && value.length > 0 ? (
          value
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </dd>
    </>
  );
}

export default async function DeathLedgerEntryDetailPage({
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
  if (entry.person.householdId !== household.id) {
    notFound();
  }

  const deathDate = {
    year: entry.dateOfDeath.getUTCFullYear(),
    month: entry.dateOfDeath.getUTCMonth() + 1,
    day: entry.dateOfDeath.getUTCDate(),
  };

  const anniversaries: Anniversary[] = allAnniversariesOf(deathDate);
  const currentYear = new Date().getFullYear();

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
          <span className="text-gray-700">{entry.secularName}</span>
        </nav>
        <div className="mt-2 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-serif tracking-wider">
              {entry.secularName}
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              {entry.person.nameKana}
              {entry.person.familyRelation && (
                <span className="ml-2 text-gray-500">
                  ({entry.person.familyRelation})
                </span>
              )}
            </p>
          </div>
          <Link
            href={`/danshintoto/${household.id}/kakochou/${entry.id}/edit`}
            className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            編集
          </Link>
        </div>
      </div>

      <div className="rounded border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-medium">基本情報</h2>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3">
          <DetailRow label="戒名" value={entry.kaimyoName} />
          <DetailRow
            label="命日 (西暦)"
            value={`${deathDate.year}/${deathDate.month}/${deathDate.day}`}
          />
          <DetailRow label="命日 (和暦)" value={entry.dateOfDeathWareki} />
          <DetailRow
            label="行年"
            value={entry.ageAtDeath !== null ? `${entry.ageAtDeath} 歳` : null}
          />
          <DetailRow label="埋葬場所" value={entry.burialLocation} />
        </dl>
      </div>

      <div className="rounded border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium">年忌予定</h2>
            <p className="mt-1 text-sm text-gray-600">
              命日を起点に一周忌〜五十回忌までを自動計算しています。
              2/29 命日で平年の場合は 3/1 に補正されます。
            </p>
          </div>
        </div>
        <div className="mt-5 overflow-hidden rounded border border-gray-200">
          <table className="w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-4 py-2">回忌</th>
                <th className="px-4 py-2">予定年</th>
                <th className="px-4 py-2">予定日</th>
                <th className="px-4 py-2">状態</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {anniversaries.map((a) => {
                const status = statusOf(a.year, currentYear);
                return (
                  <tr key={a.kaiki} className={statusClass(status)}>
                    <td className="px-4 py-2 font-medium">{a.name}</td>
                    <td className="px-4 py-2">{a.year}</td>
                    <td className="px-4 py-2">
                      {formatSchedule(a.month, a.day)}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {statusLabel(status)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-medium">備考</h2>
        <div className="mt-3 whitespace-pre-wrap text-sm text-gray-900">
          {entry.memo && entry.memo.length > 0 ? (
            entry.memo
          ) : (
            <span className="text-gray-400">—</span>
          )}
        </div>
      </div>

      <div className="rounded border border-red-200 bg-red-50 p-6">
        <h2 className="text-base font-medium text-red-900">
          過去帳一覧からの除外
        </h2>
        <p className="mt-2 text-sm text-red-800">
          誤登録や重複の修正目的で、このエントリを一覧から除外します。
          <br />
          物理削除は行いません (データと履歴は保持されます)。復元が必要になった場合は管理者にご相談ください。
        </p>
        <div className="mt-4">
          <SoftDeleteEntryButton
            entryId={entry.id}
            secularName={entry.secularName}
          />
        </div>
      </div>
    </div>
  );
}
