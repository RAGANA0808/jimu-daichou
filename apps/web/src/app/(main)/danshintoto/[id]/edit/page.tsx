import Link from 'next/link';
import { notFound } from 'next/navigation';
import { updateHouseholdAction } from '@/features/danshintoto/actions';
import { HouseholdForm } from '@/features/danshintoto/HouseholdForm';
import { getHouseholdById } from '@/features/danshintoto/queries';

export default async function EditHouseholdPage({
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
          <span className="text-gray-700">編集</span>
        </nav>
        <h1 className="mt-2 text-2xl font-serif tracking-wider">
          世帯を編集する
        </h1>
      </div>

      <div className="rounded border border-gray-200 bg-white p-6">
        <HouseholdForm
          action={updateHouseholdAction}
          submitLabel="保存する"
          householdId={household.id}
          cancelHref={`/danshintoto/${household.id}`}
          initialValues={{
            householderName: household.householderName,
            nameKana: household.nameKana,
            postalCode: household.postalCode ?? '',
            address: household.address ?? '',
            phone: household.phone ?? '',
            mobile: household.mobile ?? '',
            email: household.email ?? '',
            memo: household.memo ?? '',
          }}
        />
      </div>
    </div>
  );
}
