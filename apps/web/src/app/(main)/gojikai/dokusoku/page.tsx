import Link from 'next/link';
import { Button, EmptyState, PageHeader } from '@/components/ui';
import { listDunningCandidatesForYear } from '@/features/gojikai/queries';
import { DunningWorkflow } from '@/features/gojikai/DunningWorkflow';
import { currentFiscalYear } from '@/features/gojikai/format';

function parseYearParam(raw: string | undefined, fallback: number): number {
  if (!raw || !/^\d{4}$/.test(raw)) return fallback;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n) || n < 2000 || n > 2200) return fallback;
  return n;
}

export default async function DunningPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const sp = await searchParams;
  const year = parseYearParam(sp.year, currentFiscalYear());
  const candidates = await listDunningCandidatesForYear(year);

  return (
    <div className="space-y-6">
      <PageHeader
        title="護持会費 督促"
        description="未集金の世帯を確認し、督促状を作成・発送記録します。"
        breadcrumbs={[
          { label: 'ダッシュボード', href: '/dashboard' },
          { label: '護持会費', href: '/gojikai' },
          { label: `${year} 年度`, href: `/gojikai?year=${year}` },
          { label: '督促' },
        ]}
      />

      {candidates.length === 0 ? (
        <EmptyState
          title={`${year} 年度に未集金の世帯はありません`}
          description="すべての請求が完納済みか、この年度の請求がまだ作成されていません。"
          action={
            <Link href={`/gojikai?year=${year}`}>
              <Button>年度の状況へ戻る</Button>
            </Link>
          }
        />
      ) : (
        <DunningWorkflow fiscalYear={year} candidates={candidates} />
      )}
    </div>
  );
}
