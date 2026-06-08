import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button, EmptyState, PageHeader } from '@/components/ui';
import {
  getHouseholdLite,
  getInitialAmountsForYear,
  listActiveSubjects,
} from '@/features/postal-transfer/queries';
import { currentFiscalYear } from '@/features/postal-transfer/format';
import { SingleSlipGenerator } from '@/features/postal-transfer/PostalTransferGenerator';
import {
  resolveSubjectLines,
  type HouseholdSourceAmounts,
  type SubjectTemplate,
} from '@/lib/postal-transfer';

function parseYear(raw: string | undefined, fallback: number): number {
  if (!raw || !/^\d{4}$/.test(raw)) return fallback;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n) || n < 2000 || n > 2200) return fallback;
  return n;
}

export default async function HouseholdSlipPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const year = parseYear(sp.year, currentFiscalYear());

  const household = await getHouseholdLite(id);
  if (!household) notFound();

  const [subjectsRaw, initialAmounts] = await Promise.all([
    listActiveSubjects(),
    getInitialAmountsForYear(year),
  ]);

  const subjectTemplates: SubjectTemplate[] = subjectsRaw.map((s) => ({
    id: s.id,
    name: s.name,
    defaultAmount: s.defaultAmount,
    isVisible: s.isVisible,
    amountSource: s.amountSource,
  }));

  const sourceAmounts: HouseholdSourceAmounts =
    initialAmounts.get(household.id) ?? {};
  const lines = resolveSubjectLines(subjectTemplates, sourceAmounts);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`郵便振替用紙の作成（${household.householderName} 様）`}
        description={`${year} 年度の請求額を初期値に表示しています。金額は出力前に調整できます。`}
        breadcrumbs={[
          { label: 'ダッシュボード', href: '/dashboard' },
          { label: '檀信徒', href: '/danshintoto' },
          { label: household.householderName, href: `/danshintoto/${household.id}` },
          { label: '郵便振替' },
        ]}
        actions={
          <Link href={`/danshintoto/${household.id}`}>
            <Button variant="secondary">カルテへ戻る</Button>
          </Link>
        }
      />

      {subjectsRaw.length === 0 ? (
        <EmptyState
          title="科目が登録されていません"
          description="郵便振替の設定から科目を追加すると、この世帯の振替用紙を作成できます。"
          action={
            <Link href="/furikae/settings">
              <Button>科目を設定する</Button>
            </Link>
          }
        />
      ) : (
        <SingleSlipGenerator
          fiscalYear={year}
          householdId={household.id}
          lines={lines}
        />
      )}
    </div>
  );
}
