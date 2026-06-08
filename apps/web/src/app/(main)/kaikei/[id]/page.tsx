import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTransactionById } from '@/features/kaikei/queries';
import {
  TRANSACTION_CATEGORY_LABELS,
  TRANSACTION_DIRECTION_LABELS,
} from '@/features/kaikei/types';
import { can, getCurrentRole } from '@/lib/auth';
import { DocumentSection } from '@/features/documents/DocumentSection';
import { listDocumentsByTransaction } from '@/features/documents/queries';

function formatJaDate(d: Date): string {
  return `${d.getUTCFullYear()}/${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

function formatJaDateTime(d: Date): string {
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

function formatYen(amount: number): string {
  return `${amount.toLocaleString('ja-JP')} 円`;
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">
        {value && value.length > 0 ? value : <span className="text-muted-foreground">—</span>}
      </dd>
    </>
  );
}

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tx = await getTransactionById(id);
  if (!tx) {
    notFound();
  }

  const [documents, role] = await Promise.all([
    listDocumentsByTransaction(tx.id),
    getCurrentRole(),
  ]);
  const canEditDocs = role !== null && can(role, 'create');
  const canDeleteDocs = role !== null && can(role, 'destructive');

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
          <span className="text-foreground">{formatJaDate(tx.paidAt)} の記録</span>
        </nav>
        <div className="mt-2 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-rounded tracking-wider">
              {TRANSACTION_DIRECTION_LABELS[tx.direction]} ・{' '}
              {TRANSACTION_CATEGORY_LABELS[tx.category]}
            </h1>
            <p
              className={`mt-1 text-3xl font-medium ${
                tx.direction === 'INCOME' ? 'text-foreground' : 'text-orange-700'
              }`}
            >
              {tx.direction === 'EXPENSE' ? '−' : ''}
              {formatYen(tx.amount)}
            </p>
          </div>
          <Link
            href={`/kaikei/${tx.id}/edit`}
            className="rounded border border-border px-4 py-2 text-sm text-foreground hover:bg-muted"
          >
            編集
          </Link>
        </div>
      </div>

      <div className="rounded border border-border bg-surface p-6">
        <h2 className="text-lg font-medium">記録内容</h2>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3">
          <DetailRow label="日付" value={formatJaDate(tx.paidAt)} />
          <DetailRow
            label="区分"
            value={TRANSACTION_DIRECTION_LABELS[tx.direction]}
          />
          <DetailRow
            label="カテゴリ"
            value={TRANSACTION_CATEGORY_LABELS[tx.category]}
          />
          <DetailRow label="金額" value={formatYen(tx.amount)} />
          <DetailRow label="支払方法" value={tx.paymentMethod} />
          <dt className="text-sm text-muted-foreground">世帯</dt>
          <dd className="text-sm text-foreground">
            {tx.household ? (
              <Link
                href={`/danshintoto/${tx.household.id}`}
                className="text-foreground underline decoration-border underline-offset-2 hover:decoration-brand"
              >
                {tx.household.householderName}（{tx.household.nameKana}）
              </Link>
            ) : (
              <span className="text-muted-foreground">— (寺側の経費・寄付等)</span>
            )}
          </dd>
        </dl>
      </div>

      <div className="rounded border border-border bg-surface p-6">
        <h2 className="text-lg font-medium">備考</h2>
        <div className="mt-3 whitespace-pre-wrap text-sm text-foreground">
          {tx.memo && tx.memo.length > 0 ? (
            tx.memo
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </div>
      </div>

      <DocumentSection
        target={{ kind: 'transaction', id: tx.id }}
        documents={documents}
        canEdit={canEditDocs}
        canDelete={canDeleteDocs}
      />

      <div className="rounded border border-border bg-surface p-6 text-sm text-muted-foreground">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
          <dt>登録日</dt>
          <dd>{formatJaDateTime(tx.createdAt)}</dd>
          <dt>最終更新</dt>
          <dd>{formatJaDateTime(tx.updatedAt)}</dd>
          <dt>取引 ID</dt>
          <dd className="font-mono text-xs">{tx.id}</dd>
        </dl>
      </div>
    </div>
  );
}
