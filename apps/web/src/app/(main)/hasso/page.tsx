import Link from 'next/link';
import {
  Badge,
  Button,
  EmptyState,
  PageHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import { listShipmentBatches } from '@/features/shipment/queries';
import { DOCUMENT_TYPE_LABELS } from '@/features/shipment/types';

function formatDate(d: Date): string {
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

export default async function HassoPage() {
  const batches = await listShipmentBatches();
  const currentYear = new Date().getFullYear();

  return (
    <div className="space-y-6">
      <PageHeader
        title="発送"
        description="法要案内の宛名・封筒・案内状を作り、発送を記録します。"
        breadcrumbs={[
          { label: 'ダッシュボード', href: '/dashboard' },
          { label: '発送' },
        ]}
        actions={
          <Link href={`/hasso/new?year=${currentYear}`}>
            <Button>案内を出す</Button>
          </Link>
        }
      />

      {batches.length === 0 ? (
        <EmptyState
          title="発送の記録はまだありません"
          description="「案内を出す」から、年忌の対象世帯へ案内状や宛名ラベルを作成できます。"
          action={
            <Link href={`/hasso/new?year=${currentYear}`}>
              <Button>案内を出す</Button>
            </Link>
          }
        />
      ) : (
        <>
          {/* PC: テーブル */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>発送名</TableHead>
                  <TableHead>種別</TableHead>
                  <TableHead>宛先</TableHead>
                  <TableHead>発送日</TableHead>
                  <TableHead>担当</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <Link
                        href={`/hasso/${b.id}`}
                        className="text-info hover:underline"
                      >
                        {b.title}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="neutral">
                        {DOCUMENT_TYPE_LABELS[b.documentType] ?? b.documentType}
                      </Badge>
                    </TableCell>
                    <TableCell>{b.recipientCount} 世帯</TableCell>
                    <TableCell>{formatDate(b.createdAt)}</TableCell>
                    <TableCell>{b.sentByName ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* スマホ: カード */}
          <ul className="space-y-3 md:hidden">
            {batches.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/hasso/${b.id}`}
                  className="block rounded-lg border border-border bg-surface p-4 shadow-sm"
                >
                  <div className="font-medium text-foreground">{b.title}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <Badge variant="neutral">
                      {DOCUMENT_TYPE_LABELS[b.documentType] ?? b.documentType}
                    </Badge>
                    <span>{b.recipientCount} 世帯</span>
                    <span>{formatDate(b.createdAt)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
