import Link from 'next/link';
import { findAnniversariesForYear } from '@/features/nenki/queries';

function parseYearParam(raw: string | undefined): number {
  const now = new Date().getFullYear();
  if (!raw) return now;
  const n = Number.parseInt(raw, 10);
  // あまり極端な値は現在年に丸める (タイプミス対策)
  if (Number.isNaN(n) || !Number.isFinite(n) || n < 1800 || n > 2200) {
    return now;
  }
  return n;
}

function formatSchedule(
  month: number | null,
  day: number | null,
): string {
  if (month === null || day === null) return '— (月日不明)';
  return `${month}月${day}日`;
}

export default async function NenkiPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const sp = await searchParams;
  const targetYear = parseYearParam(sp.year);
  const currentYear = new Date().getFullYear();

  const matches = await findAnniversariesForYear(targetYear);

  return (
    <div className="space-y-6">
      <div>
        <nav className="text-sm text-gray-500">
          <Link href="/dashboard" className="hover:underline">
            ダッシュボード
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-700">年忌表</span>
        </nav>
        <div className="mt-2 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-serif tracking-wider">
              年忌表 {targetYear} 年
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              この年に年忌を迎える故人の一覧です。離檀された世帯は除いています。
            </p>
          </div>
          {matches.length > 0 && (
            <a
              href={`/api/nenki/pdf?year=${targetYear}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800"
            >
              案内状 PDF を生成 ({new Set(matches.map((m) => m.householdId)).size} 世帯)
            </a>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <Link
          href={`/nenki?year=${targetYear - 1}`}
          className="rounded border border-gray-300 px-3 py-1 text-gray-700 hover:bg-gray-100"
        >
          ← {targetYear - 1} 年
        </Link>
        {targetYear !== currentYear && (
          <Link
            href="/nenki"
            className="rounded border border-gray-300 px-3 py-1 text-gray-700 hover:bg-gray-100"
          >
            今年 ({currentYear})
          </Link>
        )}
        <Link
          href={`/nenki?year=${targetYear + 1}`}
          className="rounded border border-gray-300 px-3 py-1 text-gray-700 hover:bg-gray-100"
        >
          {targetYear + 1} 年 →
        </Link>
      </div>

      {matches.length === 0 ? (
        <div className="rounded border border-dashed border-gray-300 bg-white p-10 text-center">
          <p className="text-gray-600">
            {targetYear} 年に年忌を迎える故人はいません。
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded border border-gray-200 bg-white">
          <table className="w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-4 py-3">回忌</th>
                <th className="px-4 py-3">予定日</th>
                <th className="px-4 py-3">世帯 (施主)</th>
                <th className="px-4 py-3">俗名</th>
                <th className="px-4 py-3">戒名</th>
                <th className="px-4 py-3">命日</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {matches.map((m) => (
                <tr key={m.entryId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {m.anniversary.name}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {formatSchedule(
                      m.anniversary.month,
                      m.anniversary.day,
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    <Link
                      href={`/danshintoto/${m.householdId}`}
                      className="hover:underline"
                    >
                      {m.householdName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-900">
                    <Link
                      href={`/danshintoto/${m.householdId}/kakochou/${m.entryId}`}
                      className="hover:underline"
                    >
                      {m.secularName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {m.kaimyoName ?? <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {m.deathDate.year}/{m.deathDate.month}/{m.deathDate.day}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-500">
        ※ 対象は 1/3/7/13/17/23/27/33/37/50 回忌です。2/29 が命日の方で、法要年が平年の場合は 3/1 に補正しています。
      </p>
    </div>
  );
}
