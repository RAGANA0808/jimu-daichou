import Link from 'next/link';
import { Badge, Card, CardContent, PageHeader } from '@/components/ui';
import { listExportEntities } from '@/lib/export';

export const metadata = {
  title: 'データ書き出し | 寺務台帳',
};

export default function ExportLandingPage() {
  const entities = listExportEntities();

  return (
    <div className="space-y-6">
      <PageHeader
        title="データ書き出し"
        description="世帯・過去帳・区画・会計の記録を CSV / Excel で書き出します。バックアップや他システムへの移行にご利用ください。"
        breadcrumbs={[
          { label: 'ダッシュボード', href: '/dashboard' },
          { label: 'データ書き出し' },
        ]}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {entities.map((entity) => (
          <Link
            key={entity.id}
            href={`/export/${entity.id}`}
            className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-2"
          >
            <Card className="h-full transition-colors hover:bg-muted/50">
              <CardContent className="space-y-2 py-5">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-foreground">
                    {entity.label}
                  </h2>
                  <Badge variant="success">書き出し</Badge>
                </div>
                <p className="text-base text-muted-foreground">
                  {entity.description}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardContent className="py-5">
          <p className="text-sm text-muted-foreground">
            データを取り込みたい場合は{' '}
            <Link href="/import" className="text-info underline">
              データ取込
            </Link>{' '}
            をご利用ください。書き出した列はそのまま取込にも使えます。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
