import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui';
import { getExportEntity } from '@/lib/export';
import { ExportPanel } from '@/features/export/ExportPanel';

export default async function ExportEntityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const def = getExportEntity(id);
  if (!def) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${def.label} の書き出し`}
        description="形式 (CSV / Excel) を選び、必要に応じて条件で絞り込んで書き出します。"
        breadcrumbs={[
          { label: 'ダッシュボード', href: '/dashboard' },
          { label: 'データ書き出し', href: '/export' },
          { label: def.label },
        ]}
      />
      <ExportPanel
        entity={{
          id: def.id,
          label: def.label,
          description: def.description,
          filterKind: def.filterKind,
        }}
      />
    </div>
  );
}
