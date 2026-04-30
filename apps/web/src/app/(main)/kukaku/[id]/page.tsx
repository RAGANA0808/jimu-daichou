import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getGravePlotById } from '@/features/kukaku/queries';
import {
  GRAVE_PLOT_STATUS_LABELS,
  GRAVE_PLOT_TYPE_LABELS,
} from '@/features/kukaku/types';

function formatJaDate(d: Date): string {
  return `${d.getUTCFullYear()}/${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

function formatTimestamp(d: Date): string {
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined | React.ReactNode;
}) {
  return (
    <>
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-900">
        {value ? value : <span className="text-gray-400">—</span>}
      </dd>
    </>
  );
}

export default async function GravePlotDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const plot = await getGravePlotById(id);
  if (!plot) {
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
          <span className="text-gray-700">{plot.plotNumber}</span>
        </nav>
        <div className="mt-2 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-serif tracking-wider">
              区画 {plot.plotNumber}
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              {GRAVE_PLOT_TYPE_LABELS[plot.plotType]} — {GRAVE_PLOT_STATUS_LABELS[plot.status]}
            </p>
          </div>
          <Link
            href={`/kukaku/${plot.id}/edit`}
            className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            編集
          </Link>
        </div>
      </div>

      <div className="rounded border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-medium">区画情報</h2>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3">
          <DetailRow label="区画番号" value={plot.plotNumber} />
          <DetailRow
            label="種別"
            value={GRAVE_PLOT_TYPE_LABELS[plot.plotType]}
          />
          <DetailRow
            label="状態"
            value={GRAVE_PLOT_STATUS_LABELS[plot.status]}
          />
          <DetailRow
            label="契約世帯"
            value={
              plot.household ? (
                <Link
                  href={`/danshintoto/${plot.household.id}`}
                  className="text-gray-900 underline decoration-gray-300 underline-offset-2 hover:decoration-gray-900"
                >
                  {plot.household.householderName}
                </Link>
              ) : null
            }
          />
          <DetailRow
            label="エリア"
            value={
              plot.area ? (
                <span>
                  {plot.area.name}
                  {plot.positionX !== null && plot.positionY !== null && (
                    <span className="ml-2 text-xs text-gray-500">
                      (配置済: {plot.positionX}, {plot.positionY})
                    </span>
                  )}
                </span>
              ) : null
            }
          />
          <DetailRow
            label="契約日"
            value={plot.contractDate ? formatJaDate(plot.contractDate) : null}
          />
          <DetailRow label="契約プラン" value={plot.contractPlan} />
        </dl>
      </div>

      <div className="rounded border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-medium">備考</h2>
        <div className="mt-3 whitespace-pre-wrap text-sm text-gray-900">
          {plot.memo && plot.memo.length > 0 ? (
            plot.memo
          ) : (
            <span className="text-gray-400">—</span>
          )}
        </div>
      </div>

      <div className="rounded border border-gray-200 bg-white p-6 text-sm text-gray-500">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
          <dt>登録日</dt>
          <dd>{formatTimestamp(plot.createdAt)}</dd>
          <dt>最終更新</dt>
          <dd>{formatTimestamp(plot.updatedAt)}</dd>
          <dt>区画 ID</dt>
          <dd className="font-mono text-xs">{plot.id}</dd>
        </dl>
      </div>
    </div>
  );
}
