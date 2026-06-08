import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import { getShipmentBatchById } from '@/features/shipment/queries';
import { DOCUMENT_TYPE_LABELS } from '@/features/shipment/types';

function formatDate(d: Date): string {
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateTime(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${formatDate(d)} ${hh}:${mm}`;
}

export default async function HassoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const batch = await getShipmentBatchById(id);
  if (!batch) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={batch.title}
        description={`${formatDate(batch.createdAt)} に記録（${batch.recipientCount} 世帯）`}
        breadcrumbs={[
          { label: 'ダッシュボード', href: '/dashboard' },
          { label: '発送', href: '/hasso' },
          { label: batch.title },
        ]}
        actions={
          <Link href="/hasso">
            <Button variant="secondary">発送一覧へ</Button>
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">発送の内容</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted-foreground">種別</dt>
              <dd className="mt-0.5">
                <Badge variant="neutral">
                  {DOCUMENT_TYPE_LABELS[batch.documentType] ?? batch.documentType}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">担当</dt>
              <dd className="mt-0.5 text-foreground">
                {batch.sentByName ?? '—'}
              </dd>
            </div>
            {batch.serviceDate && (
              <div>
                <dt className="text-sm text-muted-foreground">法要日時</dt>
                <dd className="mt-0.5 text-foreground">
                  {formatDateTime(batch.serviceDate)}
                </dd>
              </div>
            )}
            {batch.location && (
              <div>
                <dt className="text-sm text-muted-foreground">場所</dt>
                <dd className="mt-0.5 text-foreground">{batch.location}</dd>
              </div>
            )}
            {batch.offeringGuide && (
              <div>
                <dt className="text-sm text-muted-foreground">お布施の目安</dt>
                <dd className="mt-0.5 text-foreground">{batch.offeringGuide}</dd>
              </div>
            )}
            {batch.replyDeadline && (
              <div>
                <dt className="text-sm text-muted-foreground">返信締切</dt>
                <dd className="mt-0.5 text-foreground">
                  {formatDate(batch.replyDeadline)}
                </dd>
              </div>
            )}
          </dl>
          {batch.bodyNote && (
            <div className="mt-4 border-t border-border pt-4">
              <dt className="text-sm text-muted-foreground">本文への追記</dt>
              <dd className="mt-1 whitespace-pre-wrap text-foreground">
                {batch.bodyNote}
              </dd>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            宛先（{batch.recipients.length} 世帯）
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 py-0 sm:px-0">
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>宛名</TableHead>
                  <TableHead>住所</TableHead>
                  <TableHead>対象</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batch.recipients.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      {r.householdId ? (
                        <Link
                          href={`/danshintoto/${r.householdId}`}
                          className="text-info hover:underline"
                        >
                          {r.householderName} 様
                        </Link>
                      ) : (
                        `${r.householderName} 様`
                      )}
                    </TableCell>
                    <TableCell>
                      {r.address ? (
                        <>
                          {r.postalCode && (
                            <span className="text-sm text-muted-foreground">
                              〒{r.postalCode}{' '}
                            </span>
                          )}
                          {r.address}
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>{r.summary ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ul className="space-y-2 px-4 py-4 md:hidden">
            {batch.recipients.map((r) => (
              <li
                key={r.id}
                className="rounded-lg border border-border bg-surface p-3"
              >
                <div className="font-medium text-foreground">
                  {r.householdId ? (
                    <Link
                      href={`/danshintoto/${r.householdId}`}
                      className="text-info hover:underline"
                    >
                      {r.householderName} 様
                    </Link>
                  ) : (
                    `${r.householderName} 様`
                  )}
                </div>
                {r.summary && (
                  <div className="mt-1 text-sm text-foreground">{r.summary}</div>
                )}
                {r.address && (
                  <div className="mt-1 text-sm text-muted-foreground">
                    {r.postalCode && `〒${r.postalCode} `}
                    {r.address}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
