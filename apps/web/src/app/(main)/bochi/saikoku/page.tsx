import Link from 'next/link';
import { Button, EmptyState, PageHeader } from '@/components/ui';
import { listDemandCandidates } from '@/features/bochi/queries';
import { DemandWorkflow } from '@/features/bochi/DemandWorkflow';
import { currentFiscalYear } from '@/features/bochi/format';

function parseYearParam(raw: string | undefined, fallback: number): number {
  if (!raw || !/^\d{4}$/.test(raw)) return fallback;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n) || n < 2000 || n > 2200) return fallback;
  return n;
}

export default async function DemandPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const sp = await searchParams;
  const year = parseYearParam(sp.year, currentFiscalYear());
  const candidates = await listDemandCandidates(year);

  return (
    <div className="space-y-6">
      <PageHeader
        title="墓地管理料 催告"
        description="滞納区画を確認し、催告状を作成・発送記録します。宛名は区画の契約世帯から解決します。"
        breadcrumbs={[
          { label: 'ダッシュボード', href: '/dashboard' },
          { label: '墓地管理料', href: '/bochi' },
          { label: `${year} 年度`, href: `/bochi?year=${year}` },
          { label: '催告' },
        ]}
      />

      {candidates.length === 0 ? (
        <EmptyState
          title="滞納している区画はありません"
          description="未納の残る区画はありません。すべての管理料が納入済みです。"
          action={
            <Link href={`/bochi?year=${year}`}>
              <Button>年度の状況へ戻る</Button>
            </Link>
          }
        />
      ) : (
        <DemandWorkflow fiscalYear={year} candidates={candidates} />
      )}
    </div>
  );
}
