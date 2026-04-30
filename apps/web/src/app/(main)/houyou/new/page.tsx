import Link from 'next/link';
import { createMemorialServiceAction } from '@/features/houyou/actions';
import { MemorialServiceForm } from '@/features/houyou/MemorialServiceForm';
import { getHouseholdById } from '@/features/danshintoto/queries';
import { isValidUuid } from '@/lib/db';

export default async function NewMemorialServicePage({
  searchParams,
}: {
  searchParams: Promise<{ householdId?: string }>;
}) {
  const { householdId } = await searchParams;

  const household =
    householdId && isValidUuid(householdId)
      ? await getHouseholdById(householdId)
      : null;

  if (!household) {
    return (
      <div className="space-y-6">
        <div>
          <nav className="text-sm text-gray-500">
            <Link href="/dashboard" className="hover:underline">
              ダッシュボード
            </Link>
            <span className="mx-2">/</span>
            <Link href="/houyou" className="hover:underline">
              法要
            </Link>
            <span className="mx-2">/</span>
            <span className="text-gray-700">新規登録</span>
          </nav>
          <h1 className="mt-2 text-2xl font-serif tracking-wider">
            法要を登録する
          </h1>
        </div>
        <div className="rounded border border-amber-200 bg-amber-50 p-6">
          <p className="text-sm text-amber-900">
            法要はまず対象の世帯を選んでからご登録ください。
          </p>
          <div className="mt-3">
            <Link
              href="/danshintoto"
              className="rounded bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800"
            >
              檀信徒カルテを開く
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <nav className="text-sm text-gray-500">
          <Link href="/dashboard" className="hover:underline">
            ダッシュボード
          </Link>
          <span className="mx-2">/</span>
          <Link href="/houyou" className="hover:underline">
            法要
          </Link>
          <span className="mx-2">/</span>
          <Link
            href={`/danshintoto/${household.id}`}
            className="hover:underline"
          >
            {household.householderName}
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-700">新規登録</span>
        </nav>
        <h1 className="mt-2 text-2xl font-serif tracking-wider">
          法要を登録する
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          {household.householderName} 家の法要予定を追加します。
        </p>
      </div>

      <div className="rounded border border-gray-200 bg-white p-6">
        <MemorialServiceForm
          action={createMemorialServiceAction}
          submitLabel="登録する"
          householdId={household.id}
          cancelHref={`/danshintoto/${household.id}`}
        />
      </div>
    </div>
  );
}
