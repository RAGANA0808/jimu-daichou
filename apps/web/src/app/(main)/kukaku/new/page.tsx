import Link from 'next/link';
import { createGravePlotAction } from '@/features/kukaku/actions';
import { listGravePlotAreasForSelect } from '@/features/kukaku/areas/queries';
import { GravePlotForm } from '@/features/kukaku/GravePlotForm';
import { listHouseholdsForSelect } from '@/features/kukaku/queries';

export default async function NewGravePlotPage() {
  const [householdOptions, areaOptions] = await Promise.all([
    listHouseholdsForSelect(),
    listGravePlotAreasForSelect(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <nav className="text-sm text-gray-500">
          <Link href="/dashboard" className="hover:underline">
            ダッシュボード
          </Link>
          <span className="mx-2">/</span>
          <Link href="/kukaku" className="hover:underline">
            区画
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-700">新規登録</span>
        </nav>
        <h1 className="mt-2 text-2xl font-serif tracking-wider">区画を登録する</h1>
      </div>

      <div className="rounded border border-gray-200 bg-white p-6">
        <GravePlotForm
          action={createGravePlotAction}
          submitLabel="登録する"
          cancelHref="/kukaku"
          householdOptions={householdOptions}
          areaOptions={areaOptions}
        />
      </div>
    </div>
  );
}
