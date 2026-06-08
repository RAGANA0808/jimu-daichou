import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TenantSettingsForm } from '@/features/settings/TenantSettingsForm';
import { getCurrentTenant } from '@/features/settings/queries';

export default async function EditSettingsPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <nav className="text-sm text-muted-foreground">
          <Link href="/dashboard" className="hover:underline">
            ダッシュボード
          </Link>
          <span className="mx-2">/</span>
          <Link href="/settings" className="hover:underline">
            設定
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">編集</span>
        </nav>
        <h1 className="mt-2 text-2xl font-rounded tracking-wider">設定を編集する</h1>
      </div>

      <div className="rounded border border-border bg-surface p-6">
        <TenantSettingsForm
          initialValues={{
            name: tenant.name,
            headPriestName: tenant.headPriestName ?? '',
          }}
        />
      </div>
    </div>
  );
}
