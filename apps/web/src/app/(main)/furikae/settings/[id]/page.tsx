import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button, PageHeader } from '@/components/ui';
import { getSubjectById } from '@/features/postal-transfer/queries';
import { SubjectForm } from '@/features/postal-transfer/SubjectForm';

export default async function EditSubjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const subject = await getSubjectById(id);
  if (!subject) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title="科目の編集"
        breadcrumbs={[
          { label: 'ダッシュボード', href: '/dashboard' },
          { label: '郵便振替', href: '/furikae' },
          { label: '設定', href: '/furikae/settings' },
          { label: subject.name },
        ]}
        actions={
          <Link href="/furikae/settings">
            <Button variant="secondary">設定へ戻る</Button>
          </Link>
        }
      />
      <SubjectForm subject={subject} />
    </div>
  );
}
