import { AccountProfileForm } from '@/features/account/AccountProfileForm';
import { getCurrentUserProfile } from '@/features/account/queries';
import { PageHeader } from '@/components/ui';

export default async function EditAccountPage() {
  const profile = await getCurrentUserProfile();

  return (
    <div className="space-y-6">
      <PageHeader
        title="表示名を編集する"
        description="他の寺族にも見える、あなたの表示名を設定します。"
        breadcrumbs={[
          { label: 'ダッシュボード', href: '/dashboard' },
          { label: '設定', href: '/settings' },
          { label: '表示名の編集' },
        ]}
      />

      <div className="rounded border border-border bg-surface p-6">
        <AccountProfileForm initialDisplayName={profile.displayName} />
      </div>
    </div>
  );
}
