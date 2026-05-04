import Link from 'next/link';
import { notFound } from 'next/navigation';
import { updateGravePlotAction } from '@/features/kukaku/actions';
import { listGravePlotAreasForSelect } from '@/features/kukaku/areas/queries';
import { GravePlotForm } from '@/features/kukaku/GravePlotForm';
import {
  getGravePlotById,
  getHouseholdMinimalById,
  listHouseholdsForSelect,
} from '@/features/kukaku/queries';

function toIsoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default async function EditGravePlotPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [plot, baseHouseholdOptions, areaOptions] = await Promise.all([
    getGravePlotById(id),
    listHouseholdsForSelect(),
    listGravePlotAreasForSelect(),
  ]);

  if (!plot) {
    notFound();
  }

  // 既存の契約世帯が listHouseholdsForSelect に含まれない (離檀済 = isActive=false) 場合、
  // 候補に出てこなくて選択が外れたように見えてしまうので補完する。
  // 表示は「山田 太郎 (やまだたろう・離檀済)」として、住職に状態が分かるようにする。
  const householdOptions = [...baseHouseholdOptions];
  if (
    plot.householdId &&
    !householdOptions.some((h) => h.id === plot.householdId)
  ) {
    const fallback = await getHouseholdMinimalById(plot.householdId);
    if (fallback) {
      householdOptions.unshift({
        id: fallback.id,
        householderName: fallback.householderName,
        nameKana: `${fallback.nameKana}・離檀済`,
      });
    }
  }

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
          <Link href={`/kukaku/${plot.id}`} className="hover:underline">
            {plot.plotNumber}
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-700">編集</span>
        </nav>
        <h1 className="mt-2 text-2xl font-serif tracking-wider">
          区画を編集する
        </h1>
      </div>

      <div className="rounded border border-gray-200 bg-white p-6">
        <GravePlotForm
          action={updateGravePlotAction}
          submitLabel="保存する"
          cancelHref={`/kukaku/${plot.id}`}
          householdOptions={householdOptions}
          areaOptions={areaOptions}
          gravePlotId={plot.id}
          initialValues={{
            plotNumber: plot.plotNumber,
            plotType: plot.plotType,
            status: plot.status,
            householdId: plot.householdId ?? '',
            areaId: plot.areaId ?? '',
            contractDate: plot.contractDate ? toIsoDate(plot.contractDate) : '',
            contractPlan: plot.contractPlan ?? '',
            memo: plot.memo ?? '',
          }}
        />
      </div>
    </div>
  );
}
