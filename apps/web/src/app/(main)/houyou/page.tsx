import Link from 'next/link';
import { PREPARATION_STATUS_LABELS } from '@/features/houyou/types';
import { listUpcomingMemorialServices } from '@/features/houyou/queries';

function formatJstDateTime(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}/${m}/${day} ${hh}:${mm}`;
}

export default async function HouyouListPage() {
  const services = await listUpcomingMemorialServices();

  return (
    <div className="space-y-6">
      <div>
        <nav className="text-sm text-gray-500">
          <Link href="/dashboard" className="hover:underline">
            ダッシュボード
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-700">法要</span>
        </nav>
        <div className="mt-2 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-serif tracking-wider">法要</h1>
            <p className="mt-1 text-sm text-gray-600">
              今日以降の法要予定を日時昇順で表示しています。
            </p>
          </div>
        </div>
      </div>

      {services.length === 0 ? (
        <div className="rounded border border-dashed border-gray-300 bg-white p-10 text-center">
          <p className="text-gray-600">今後の法要予定はありません。</p>
          <p className="mt-1 text-sm text-gray-500">
            世帯詳細から「+ 法要を登録」で追加してください。
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded border border-gray-200 bg-white">
          <table className="w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-4 py-3">予定日時</th>
                <th className="px-4 py-3">世帯 (施主)</th>
                <th className="px-4 py-3">法要名</th>
                <th className="px-4 py-3">場所</th>
                <th className="px-4 py-3">状況</th>
                <th className="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {services.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700">
                    {formatJstDateTime(s.scheduledAt)}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    <Link
                      href={`/danshintoto/${s.household.id}`}
                      className="hover:underline"
                    >
                      {s.household.householderName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <Link
                      href={`/houyou/${s.id}`}
                      className="text-gray-900 underline decoration-gray-300 underline-offset-2 hover:decoration-gray-900"
                    >
                      {s.serviceName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {s.location ?? <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {PREPARATION_STATUS_LABELS[s.preparationStatus]}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/houyou/${s.id}/edit`}
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

      <p className="text-xs text-gray-500">
        ※ 一覧は最大 100 件 (本日以降)。過去の法要履歴は世帯詳細の法要セクションでご確認ください。
      </p>
    </div>
  );
}
