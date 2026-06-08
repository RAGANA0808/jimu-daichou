import Link from 'next/link';
import { notFound } from 'next/navigation';
import { updateTransactionAction } from '@/features/kaikei/actions';
import {
  TransactionForm,
  type HouseholdOption,
} from '@/features/kaikei/TransactionForm';
import { getTransactionById } from '@/features/kaikei/queries';
import { listHouseholds } from '@/features/danshintoto/queries';
import { TRANSACTION_CATEGORY_LABELS } from '@/features/kaikei/types';

function toIsoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default async function EditTransactionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tx = await getTransactionById(id);
  if (!tx) {
    notFound();
  }

  const households = await listHouseholds();
  const options: HouseholdOption[] = households.map((h) => ({
    id: h.id,
    householderName: h.householderName,
    nameKana: h.nameKana,
  }));

  // 紐付き世帯が離檀済み等で listHouseholds に含まれない場合の補完
  if (tx.household && !options.some((o) => o.id === tx.household!.id)) {
    options.unshift({
      id: tx.household.id,
      householderName: tx.household.householderName,
      nameKana: tx.household.nameKana,
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <nav className="text-sm text-muted-foreground">
          <Link href="/dashboard" className="hover:underline">
            ダッシュボード
          </Link>
          <span className="mx-2">/</span>
          <Link href="/kaikei" className="hover:underline">
            会計
          </Link>
          <span className="mx-2">/</span>
          <Link href={`/kaikei/${tx.id}`} className="hover:underline">
            {TRANSACTION_CATEGORY_LABELS[tx.category]}
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">編集</span>
        </nav>
        <h1 className="mt-2 text-2xl font-rounded tracking-wider">
          入出金を編集する
        </h1>
      </div>

      <div className="rounded border border-border bg-surface p-6">
        <TransactionForm
          action={updateTransactionAction}
          submitLabel="保存する"
          transactionId={tx.id}
          cancelHref={`/kaikei/${tx.id}`}
          households={options}
          initialValues={{
            direction: tx.direction,
            category: tx.category,
            amount: tx.amount.toString(),
            paidAt: toIsoDate(tx.paidAt),
            householdId: tx.household?.id ?? '',
            paymentMethod: tx.paymentMethod ?? '',
            memo: tx.memo ?? '',
          }}
        />
      </div>
    </div>
  );
}
