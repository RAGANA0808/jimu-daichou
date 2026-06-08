import Link from 'next/link';
import { redirect } from 'next/navigation';
import { listGravePlotAreasForSelect } from '@/features/kukaku/areas/queries';
import { MapBoard } from '@/features/kukaku/map/MapBoard';
import { getMapAreaData, type MapPlot } from '@/features/kukaku/map/queries';
import type { MapPlotTile } from '@/features/kukaku/map/types';
import { StatusLegend } from '@/features/kukaku/map/StatusLegend';
import { GRAVE_PLOT_TYPE_LABELS } from '@/features/kukaku/types';

function toTile(p: MapPlot): MapPlotTile {
  return {
    id: p.id,
    plotNumber: p.plotNumber,
    plotType: p.plotType,
    status: p.status,
    areaId: p.areaId,
    positionX: p.positionX,
    positionY: p.positionY,
    householderName: p.household?.householderName ?? null,
    monumentName: p.monumentName,
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
          <nav className="text-sm text-muted-foreground">
            <Link href="/dashboard" className="hover:underline">
              ダッシュボード
            </Link>
            <span className="mx-2">/</span>
            <Link href="/kukaku" className="hover:underline">
              区画
            </Link>
            <span className="mx-2">/</span>
            <span className="text-foreground">地図</span>
          </nav>
          <h1 className="mt-2 text-2xl font-rounded tracking-wider">区画地図</h1>
        </div>
        <div className="rounded border border-dashed border-border bg-surface p-10 text-center">
          <p className="text-muted-foreground">エリアがまだ登録されていません。</p>
          <p className="mt-1 text-sm text-muted-foreground">
            地図を使うには、まずエリアを 1 つ以上登録してください
            (例: 東墓地・西墓地・永代供養区)。
          </p>
          <Link
            href="/kukaku/areas/new"
            className="mt-4 inline-block inline-flex min-h-touch items-center rounded bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-hover"
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
        <nav className="text-sm text-muted-foreground">
          <Link href="/dashboard" className="hover:underline">
            ダッシュボード
          </Link>
          <span className="mx-2">/</span>
          <Link href="/kukaku" className="hover:underline">
            区画
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">地図</span>
        </nav>
        <div className="mt-2">
          <h1 className="text-2xl font-rounded tracking-wider">区画地図</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            エリアを選択し、右の「未配置」からドラッグして区画を配置できます。
            配置済み区画は地図上でドラッグして位置を動かせます。クリックで詳細へ移動します。
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded border border-border bg-surface p-3 text-xs">
        <div className="flex flex-wrap items-center gap-x-2">
          <span className="text-muted-foreground">状態:</span>
          <StatusLegend />
        </div>
        <div className="flex flex-wrap items-center gap-x-2">
          <span className="text-muted-foreground">種別:</span>
          <span className="text-foreground">
            {Object.values(GRAVE_PLOT_TYPE_LABELS).join(' / ')}
          </span>
        </div>
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
