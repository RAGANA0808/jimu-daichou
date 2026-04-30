import Link from 'next/link';
import {
  listTransactionsByMonth,
  summarizeTransactions,
  type TransactionWithHousehold,
} from '@/features/kaikei/queries';
import {
  TRANSACTION_CATEGORY_LABELS,
  TRANSACTION_CATEGORY_ORDER,
  TRANSACTION_DIRECTION_LABELS,
} from '@/features/kaikei/types';

function formatJaDate(d: Date): string {
  return `${d.getUTCFullYear()}/${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

function formatYen(amount: number): string {
  return `${amount.toLocaleString('ja-JP')} 円`;
}

function todayJst(): { year: number; month: number } {
  // Asia/Tokyo は UTC+9 固定。.env で TZ=Asia/Tokyo 設定済み。
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function parseYearMonthParam(
  raw: string | undefined,
  fallback: { year: number; month: number },
): { year: number; month: number } {
  if (!raw) return fallback;
  const m = /^(\d{4})-(\d{2})$/.exec(raw);
  if (!m) return fallback;
  const year = Number.parseInt(m[1]!, 10);
  const month = Number.parseInt(m[2]!, 10);
  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    year < 2000 ||
    year > 2200 ||
    month < 1 ||
    month > 12
  ) {
    return fallback;
  }
  return { year, month };
}

function shiftYearMonth(
  ym: { year: number; month: number },
  delta: number,
): { year: number; month: number } {
  // delta は -1 / +1 を想定
  const total = ym.year * 12 + (ym.month - 1) + delta;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

function formatYearMonthParam(ym: { year: number; month: number }): string {
  return `${ym.year}-${String(ym.month).padStart(2, '0')}`;
}

export default async function KaikeiListPage({
  searchParams,
}: {
  searchParams: Promise<{ ym?: string }>;
}) {
  const sp = await searchParams;
  const today = todayJst();
  const ym = parseYearMonthParam(sp.ym, today);
  const txs = await listTransactionsByMonth(ym.year, ym.month);
  const summary = summarizeTransactions(txs);

  const prev = shiftYearMonth(ym, -1);
  const next = shiftYearMonth(ym, +1);

  return (
    <div className="space-y-6">
      <div>
        <nav className="text-sm text-gray-500">
          <Link href="/dashboard" className="hover:underline">
            ダッシュボード
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-700">会計</span>
        </nav>
        <div className="mt-2 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-serif tracking-wider">会計</h1>
            <p className="mt-1 text-sm text-gray-600">
              月別の入出金記録 (護持会費・御布施・寄付・経費 等)
            </p>
          </div>
          <Link
            href="/kaikei/new"
            className="rounded bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800"
          >
            + 入出金を登録
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded border border-gray-200 bg-white p-4">
        <Link
          href={`/kaikei?ym=${formatYearMonthParam(prev)}`}
          className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-100"
        >
          ← {prev.year}年{prev.month}月
        </Link>
        <h2 className="flex-1 text-center text-lg font-medium">
          {ym.year} 年 {ym.month} 月
        </h2>
        <Link
          href={`/kaikei?ym=${formatYearMonthParam(next)}`}
          className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-100"
        >
          {next.year}年{next.month}月 →
        </Link>
        {(ym.year !== today.year || ym.month !== today.month) && (
          <Link
            href="/kaikei"
            className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-100"
          >
            今月へ
          </Link>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded border border-gray-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wider text-gray-500">
            収入
          </p>
          <p className="mt-1 text-2xl font-medium text-gray-900">
            {formatYen(summary.income)}
          </p>
        </div>
        <div className="rounded border border-gray-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wider text-gray-500">
            支出
          </p>
          <p className="mt-1 text-2xl font-medium text-gray-900">
            {formatYen(summary.expense)}
          </p>
        </div>
        <div className="rounded border border-gray-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wider text-gray-500">
            差引
          </p>
          <p
            className={`mt-1 text-2xl font-medium ${
              summary.net >= 0 ? 'text-gray-900' : 'text-red-700'
            }`}
          >
            {formatYen(summary.net)}
          </p>
        </div>
      </div>

      {summary.byCategory.length > 0 && (
        <div className="rounded border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-medium text-gray-900">カテゴリ別内訳</h3>
          <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            {TRANSACTION_CATEGORY_ORDER.flatMap((cat) =>
              summary.byCategory
                .filter((b) => b.category === cat)
                .map((b) => (
                  <li
                    key={`${b.direction}:${b.category}`}
                    className="flex items-center justify-between rounded border border-gray-100 bg-gray-50 px-3 py-2"
                  >
                    <span className="text-gray-700">
                      <span className="text-xs text-gray-500">
                        [{TRANSACTION_DIRECTION_LABELS[b.direction]}]
                      </span>{' '}
                      {TRANSACTION_CATEGORY_LABELS[b.category]} ({b.count} 件)
                    </span>
                    <span className="font-medium text-gray-900">
                      {formatYen(b.total)}
                    </span>
                  </li>
                )),
            )}
          </ul>
        </div>
      )}

      {txs.length === 0 ? (
        <div className="rounded border border-dashed border-gray-300 bg-white p-10 text-center">
          <p className="text-gray-600">
            {ym.year} 年 {ym.month} 月の入出金記録はありません。
          </p>
          <p className="mt-1 text-sm text-gray-500">
            「+ 入出金を登録」から追加してください。
          </p>
        </div>
      ) : (
        <TransactionTable txs={txs} />
      )}
    </div>
  );
}

function TransactionTable({ txs }: { txs: TransactionWithHousehold[] }) {
  return (
    <div className="overflow-hidden rounded border border-gray-200 bg-white">
      <table className="w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
          <tr>
            <th className="px-4 py-3">日付</th>
            <th className="px-4 py-3">区分</th>
            <th className="px-4 py-3">カテゴリ</th>
            <th className="px-4 py-3">世帯</th>
            <th className="px-4 py-3 text-right">金額</th>
            <th className="px-4 py-3">支払方法</th>
            <th className="px-4 py-3 text-right">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {txs.map((t) => (
            <tr key={t.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-700">
                <Link href={`/kaikei/${t.id}`} className="hover:underline">
                  {formatJaDate(t.paidAt)}
                </Link>
              </td>
              <td className="px-4 py-3 text-gray-700">
                <span
                  className={`inline-block rounded px-2 py-0.5 text-xs ${
                    t.direction === 'INCOME'
                      ? 'bg-green-50 text-green-800'
                      : 'bg-orange-50 text-orange-800'
                  }`}
                >
                  {TRANSACTION_DIRECTION_LABELS[t.direction]}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-700">
                {TRANSACTION_CATEGORY_LABELS[t.category]}
              </td>
              <td className="px-4 py-3 text-gray-700">
                {t.household ? (
                  <Link
                    href={`/danshintoto/${t.household.id}`}
                    className="hover:underline"
                  >
                    {t.household.householderName}
                  </Link>
                ) : (
                  <span className="text-gray-400">— (寺側)</span>
                )}
              </td>
              <td className="px-4 py-3 text-right font-medium text-gray-900">
                {formatYen(t.amount)}
              </td>
              <td className="px-4 py-3 text-gray-700">
                {t.paymentMethod ?? <span className="text-gray-400">—</span>}
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/kaikei/${t.id}/edit`}
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
  );
}
