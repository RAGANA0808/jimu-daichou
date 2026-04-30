import Link from 'next/link';
import { createTransactionAction } from '@/features/kaikei/actions';
import {
  TransactionForm,
  type HouseholdOption,
} from '@/features/kaikei/TransactionForm';
import { listHouseholds, getHouseholdById } from '@/features/danshintoto/queries';
import { isValidUuid } from '@/lib/db';

function todayIsoDate(): string {
  // Asia/Tokyo は UTC+9 固定。.env で TZ=Asia/Tokyo 設定済み。
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default async function NewTransactionPage({
  searchParams,
}: {
  searchParams: Promise<{ householdId?: string }>;
}) {
  const { householdId } = await searchParams;
  const lockedHousehold =
    householdId && isValidUuid(householdId)
      ? await getHouseholdById(householdId)
      : null;

  const households = await listHouseholds();
  const options: HouseholdOption[] = households.map((h) => ({
    id: h.id,
    householderName: h.householderName,
    nameKana: h.nameKana,
  }));

  // 世帯を固定する場合、その世帯がリストにない (離檀済み等) ケースに備えて補完。
  if (lockedHousehold && !options.some((o) => o.id === lockedHousehold.id)) {
    options.unshift({
      id: lockedHousehold.id,
      householderName: lockedHousehold.householderName,
      nameKana: lockedHousehold.nameKana,
    });
  }

  const cancelHref = lockedHousehold
    ? `/danshintoto/${lockedHousehold.id}`
    : '/kaikei';

  return (
    <div className="space-y-6">
      <div>
        <nav className="text-sm text-gray-500">
          <Link href="/dashboard" className="hover:underline">
            ダッシュボード
          </Link>
          <span className="mx-2">/</span>
          <Link href="/kaikei" className="hover:underline">
            会計
          </Link>
          {lockedHousehold && (
            <>
              <span className="mx-2">/</span>
              <Link
                href={`/danshintoto/${lockedHousehold.id}`}
                className="hover:underline"
              >
                {lockedHousehold.householderName}
              </Link>
            </>
          )}
          <span className="mx-2">/</span>
          <span className="text-gray-700">新規登録</span>
        </nav>
        <h1 className="mt-2 text-2xl font-serif tracking-wider">
          入出金を登録する
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          {lockedHousehold
            ? `${lockedHousehold.householderName} 家への入出金を記録します。`
            : '護持会費・御布施・寄付・経費 等を記録します。'}
        </p>
      </div>

      <div className="rounded border border-gray-200 bg-white p-6">
        <TransactionForm
          action={createTransactionAction}
          submitLabel="登録する"
          cancelHref={cancelHref}
          households={options}
          lockedHouseholdId={lockedHousehold?.id}
          initialValues={{ paidAt: todayIsoDate(), direction: 'INCOME' }}
        />
      </div>
    </div>
  );
}
