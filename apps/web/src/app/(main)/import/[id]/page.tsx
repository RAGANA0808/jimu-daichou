import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui';
import { getImportEntity } from '@/lib/import';
import { ImportWizard } from '@/features/import/ImportWizard';

export default async function ImportEntityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const def = getImportEntity(id);
  if (!def) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${def.label} の取込`}
        description="ファイルを選択し、列の対応付け・プレビューを確認してから取り込みます。"
        breadcrumbs={[
          { label: 'ダッシュボード', href: '/dashboard' },
          { label: 'データ取込', href: '/import' },
          { label: def.label },
        ]}
      />
      <ImportWizard
        entity={{ id: def.id, label: def.label, description: def.description }}
        columns={def.columns}
      />
    </div>
  );
}
