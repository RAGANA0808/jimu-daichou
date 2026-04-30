import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createFamilyMemberAction } from '@/features/kazoku/actions';
import { FamilyMemberForm } from '@/features/kazoku/FamilyMemberForm';
import { getHouseholdById } from '@/features/danshintoto/queries';

export default async function NewFamilyMemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const household = await getHouseholdById(id);
  if (!household) {
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
          <span className="text-gray-700">家族構成員の追加</span>
        </nav>
        <h1 className="mt-2 text-2xl font-serif tracking-wider">
          家族構成員を追加する
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          {household.householderName} 家の家族を登録します。
        </p>
      </div>

      <div className="rounded border border-gray-200 bg-white p-6">
        <FamilyMemberForm
          action={createFamilyMemberAction}
          submitLabel="登録する"
          householdId={household.id}
          cancelHref={`/danshintoto/${household.id}`}
        />
      </div>
    </div>
  );
}
