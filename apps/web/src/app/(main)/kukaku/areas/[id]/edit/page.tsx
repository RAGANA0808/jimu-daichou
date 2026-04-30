import Link from 'next/link';
import { notFound } from 'next/navigation';
import { updateGravePlotAreaAction } from '@/features/kukaku/areas/actions';
import { GravePlotAreaForm } from '@/features/kukaku/areas/GravePlotAreaForm';
import { getGravePlotAreaById } from '@/features/kukaku/areas/queries';

export default async function EditGravePlotAreaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const area = await getGravePlotAreaById(id);
  if (!area) {
    notFound();
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
          <Link href="/kukaku/areas" className="hover:underline">
            エリア
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-700">{area.name}</span>
          <span className="mx-2">/</span>
          <span className="text-gray-700">編集</span>
        </nav>
        <h1 className="mt-2 text-2xl font-serif tracking-wider">
          区画エリアを編集する
        </h1>
      </div>

      <div className="rounded border border-gray-200 bg-white p-6">
        <GravePlotAreaForm
          action={updateGravePlotAreaAction}
          submitLabel="保存する"
          cancelHref="/kukaku/areas"
          gravePlotAreaId={area.id}
          initialValues={{
            name: area.name,
            sortOrder: String(area.sortOrder),
            canvasWidth: String(area.canvasWidth),
            canvasHeight: String(area.canvasHeight),
          }}
        />
      </div>
    </div>
  );
}
