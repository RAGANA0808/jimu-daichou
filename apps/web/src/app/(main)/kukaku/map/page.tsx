import Link from 'next/link';
import { redirect } from 'next/navigation';
import { listGravePlotAreasForSelect } from '@/features/kukaku/areas/queries';
import { MapBoard } from '@/features/kukaku/map/MapBoard';
import { getMapAreaData } from '@/features/kukaku/map/queries';
import type { MapPlotTile } from '@/features/kukaku/map/types';
import {
  GRAVE_PLOT_STATUS_LABELS,
  GRAVE_PLOT_TYPE_LABELS,
} from '@/features/kukaku/types';
import type { GravePlot, Household } from '@prisma/client';

type RawPlot = Pick<
  GravePlot,
  | 'id'
  | 'plotNumber'
  | 'plotType'
  | 'status'
  | 'areaId'
  | 'positionX'
  | 'positionY'
> & {
  household: Pick<Household, 'id' | 'householderName'> | null;
};

function toTile(p: RawPlot): MapPlotTile {
  return {
    id: p.id,
    plotNumber: p.plotNumber,
    plotType: p.plotType,
    status: p.status,
    areaId: p.areaId,
    positionX: p.positionX,
    positionY: p.positionY,
    householderName: p.household?.householderName ?? null,
  };
}

export default async function KukakuMapPage({
  searchParams,
}: {
  searchParams: Promise<{ areaId?: string }>;
}) {
  const { areaId: requestedAreaId } = await searchParams;

  const areas = await listGravePlotAreasForSelect();

  if (areas.length === 0) {
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
            <span className="text-gray-700">地図</span>
          </nav>
          <h1 className="mt-2 text-2xl font-serif tracking-wider">区画地図</h1>
        </div>
        <div className="rounded border border-dashed border-gray-300 bg-white p-10 text-center">
          <p className="text-gray-600">エリアがまだ登録されていません。</p>
          <p className="mt-1 text-sm text-gray-500">
            地図を使うには、まずエリアを 1 つ以上登録してください
            (例: 東墓地・西墓地・永代供養区)。
          </p>
          <Link
            href="/kukaku/areas/new"
            className="mt-4 inline-block rounded bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800"
          >
            エリアを登録する
          </Link>
        </div>
      </div>
    );
  }

  const firstArea = areas[0];
  if (!firstArea) {
    // areas.length > 0 のチェック後なのでここには来ないが型ナローのため
    redirect('/kukaku/areas');
  }

  const targetAreaId =
    requestedAreaId && areas.some((a) => a.id === requestedAreaId)
      ? requestedAreaId
      : firstArea.id;

  const data = await getMapAreaData(targetAreaId);
  if (!data) {
    redirect('/kukaku/map');
  }

  const placed = data.placed.map(toTile);
  const palette = data.palette.map(toTile);

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
          <span className="text-gray-700">地図</span>
        </nav>
        <div className="mt-2">
          <h1 className="text-2xl font-serif tracking-wider">区画地図</h1>
          <p className="mt-1 text-sm text-gray-600">
            エリアを選択し、右の「未配置」からドラッグして区画を配置できます。
            配置済み区画は地図上でドラッグして位置を動かせます。クリックで詳細へ移動します。
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded border border-gray-200 bg-white p-3 text-xs">
        <span className="text-gray-500">凡例:</span>
        <LegendSwatch color="bg-gray-100 border-gray-400" label={GRAVE_PLOT_STATUS_LABELS.AVAILABLE} />
        <LegendSwatch color="bg-amber-100 border-amber-600" label={GRAVE_PLOT_STATUS_LABELS.RESERVED} />
        <LegendSwatch color="bg-blue-100 border-blue-600" label={GRAVE_PLOT_STATUS_LABELS.IN_USE} />
        <LegendSwatch color="bg-gray-50 border-gray-400 border-dashed" label={GRAVE_PLOT_STATUS_LABELS.CLOSED} />
        <span className="ml-4 text-gray-500">種別:</span>
        <span className="text-gray-700">
          {Object.values(GRAVE_PLOT_TYPE_LABELS).join(' / ')}
        </span>
      </div>

      <MapBoard
        areas={areas.map((a) => ({ id: a.id, name: a.name }))}
        currentArea={{
          id: data.area.id,
          name: data.area.name,
          canvasWidth: data.area.canvasWidth,
          canvasHeight: data.area.canvasHeight,
        }}
        placed={placed}
        palette={palette}
      />
    </div>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        aria-hidden
        className={`inline-block h-3 w-3 rounded border ${color}`}
      />
      <span className="text-gray-700">{label}</span>
    </span>
  );
}
