import Link from 'next/link';
import { Button, EmptyState, PageHeader } from '@/components/ui';
import { listShipmentCandidatesForYear } from '@/features/shipment/queries';
import { ShipmentWorkflow } from '@/features/shipment/ShipmentWorkflow';

function parseYear(raw: string | undefined): number {
  const now = new Date().getFullYear();
  if (!raw) return now;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n) || n < 1800 || n > 2200) return now;
  return n;
}

export default async function HassoNewPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const sp = await searchParams;
  const year = parseYear(sp.year);
  const candidates = await listShipmentCandidatesForYear(year);

  return (
    <div className="space-y-6">
      <PageHeader
        title="案内を出す"
        description={`${year} 年に年忌を迎える世帯へ、案内状・宛名を作成します。`}
        breadcrumbs={[
          { label: 'ダッシュボード', href: '/dashboard' },
          { label: '発送', href: '/hasso' },
          { label: '案内を出す' },
        ]}
        actions={
          <Link href={`/nenki?year=${year}`}>
            <Button variant="secondary">年忌表に戻る</Button>
          </Link>
        }
      />

      {candidates.length === 0 ? (
        <EmptyState
          title={`${year} 年に該当する宛先はありません`}
          description="年忌を迎える世帯（弔い上げ済み・離檀を除く）がいる年をお選びください。"
          action={
            <Link href="/nenki">
              <Button variant="secondary">年忌表を見る</Button>
            </Link>
          }
        />
      ) : (
        <ShipmentWorkflow year={year} candidates={candidates} />
      )}
    </div>
  );
}
