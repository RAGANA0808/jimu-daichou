import Link from 'next/link';
import { Badge, Card, CardContent, PageHeader } from '@/components/ui';
import { listImportEntities } from '@/lib/import';

export const metadata = {
  title: 'データ取込 | 寺務台帳',
};

export default function ImportLandingPage() {
  const entities = listImportEntities();

  return (
    <div className="space-y-6">
      <PageHeader
        title="データ取込"
        description="他システムや表計算ソフトの名簿 (CSV / Excel) を、寺務台帳へ取り込みます。"
        breadcrumbs={[
          { label: 'ダッシュボード', href: '/dashboard' },
          { label: 'データ取込' },
        ]}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {entities.map((entity) => (
          <Link
            key={entity.id}
            href={`/import/${entity.id}`}
            className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-2"
          >
            <Card className="h-full transition-colors hover:bg-muted/50">
              <CardContent className="space-y-2 py-5">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-foreground">
                    {entity.label}
                  </h2>
                  <Badge variant="info">取込</Badge>
                </div>
                <p className="text-base text-muted-foreground">
                  {entity.description}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
