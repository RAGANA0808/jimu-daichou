import Link from 'next/link';
import { listGravePlots } from '@/features/kukaku/queries';
import {
  GRAVE_PLOT_STATUS_LABELS,
  GRAVE_PLOT_TYPE_LABELS,
} from '@/features/kukaku/types';

export default async function KukakuListPage() {
  const plots = await listGravePlots();

  const statusCounts = {
    AVAILABLE: plots.filter((p) => p.status === 'AVAILABLE').length,
    RESERVED: plots.filter((p) => p.status === 'RESERVED').length,
    IN_USE: plots.filter((p) => p.status === 'IN_USE').length,
    CLOSED: plots.filter((p) => p.status === 'CLOSED').length,
  };

  return (
    <div className="space-y-6">
      <div>
        <nav className="text-sm text-gray-500">
          <Link href="/dashboard" className="hover:underline">
            ダッシュボード
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-700">区画</span>
        </nav>
        <div className="mt-2 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-serif tracking-wider">区画</h1>
            <p className="mt-1 text-sm text-gray-600">
              墓地区画の一覧です。区画番号順に表示しています。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/kukaku/areas"
              className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              エリア管理
            </Link>
            <Link
              href="/kukaku/map"
              className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              地図で見る
            </Link>
            <Link
              href="/kukaku/new"
              className="rounded bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800"
            >
              + 新規登録
            </Link>
          </div>
        </div>
      </div>

      {plots.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded border border-gray-200 bg-white px-4 py-3 text-sm">
            <div className="text-gray-500">空き</div>
            <div className="mt-1 text-lg font-medium">
              {statusCounts.AVAILABLE}
            </div>
          </div>
          <div className="rounded border border-gray-200 bg-white px-4 py-3 text-sm">
            <div className="text-gray-500">予約済</div>
            <div className="mt-1 text-lg font-medium">
              {statusCounts.RESERVED}
            </div>
          </div>
          <div className="rounded border border-gray-200 bg-white px-4 py-3 text-sm">
            <div className="text-gray-500">使用中</div>
            <div className="mt-1 text-lg font-medium">
              {statusCounts.IN_USE}
            </div>
          </div>
          <div className="rounded border border-gray-200 bg-white px-4 py-3 text-sm">
            <div className="text-gray-500">墓じまい済</div>
            <div className="mt-1 text-lg font-medium">
              {statusCounts.CLOSED}
            </div>
          </div>
        </div>
      )}

      {plots.length === 0 ? (
        <div className="rounded border border-dashed border-gray-300 bg-white p-10 text-center">
          <p className="text-gray-600">区画はまだ登録されていません。</p>
          <p className="mt-1 text-sm text-gray-500">
            右上の「+ 新規登録」から追加してください。
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded border border-gray-200 bg-white">
          <table className="w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-4 py-3">区画番号</th>
                <th className="px-4 py-3">種別</th>
                <th className="px-4 py-3">状態</th>
                <th className="px-4 py-3">エリア</th>
                <th className="px-4 py-3">契約世帯</th>
                <th className="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {plots.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <Link
                      href={`/kukaku/${p.id}`}
                      className="text-gray-900 underline decoration-gray-300 underline-offset-2 hover:decoration-gray-900"
                    >
                      {p.plotNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {GRAVE_PLOT_TYPE_LABELS[p.plotType]}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {GRAVE_PLOT_STATUS_LABELS[p.status]}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {p.area ? (
                      p.area.name
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {p.household ? (
                      <Link
                        href={`/danshintoto/${p.household.id}`}
                        className="hover:underline"
                      >
                        {p.household.householderName}
                      </Link>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/kukaku/${p.id}/edit`}
                      className="inline-block rounded border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-100"
                    >
                      編集
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
