import Link from 'next/link';
import { listHouseholds } from '@/features/danshintoto/queries';

function formatJaDate(d: Date): string {
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

export default async function DanshintoListPage() {
  const households = await listHouseholds();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif tracking-wider">檀信徒カルテ</h1>
          <p className="mt-1 text-sm text-gray-600">
            登録世帯の一覧です。
          </p>
        </div>
        <Link
          href="/danshintoto/new"
          className="rounded bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800"
        >
          + 新規登録
        </Link>
      </div>

      {households.length === 0 ? (
        <div className="rounded border border-dashed border-gray-300 bg-white p-10 text-center">
          <p className="text-gray-600">
            まだ世帯が登録されていません。
          </p>
          <p className="mt-1 text-sm text-gray-500">
            右上の「+ 新規登録」から最初の世帯を登録してください。
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded border border-gray-200 bg-white">
          <table className="w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-4 py-3">施主名</th>
                <th className="px-4 py-3">ふりがな</th>
                <th className="px-4 py-3">電話</th>
                <th className="px-4 py-3">登録日</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {households.map((h) => (
                <tr key={h.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <Link
                      href={`/danshintoto/${h.id}`}
                      className="hover:underline"
                    >
                      {h.householderName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{h.nameKana}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {h.phone ?? h.mobile ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {formatJaDate(h.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-500">
        ※ 一覧は最大 100 件です。詳細画面・検索・ページングは次回以降で実装します。
      </p>
    </div>
  );
}
