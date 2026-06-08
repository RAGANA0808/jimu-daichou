import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCurrentTenant } from '@/features/settings/queries';
import { SetupWizard } from '@/features/settings/SetupWizard';

export default async function SetupPage() {
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
          <span className="text-foreground">初期設定</span>
        </nav>
        <h1 className="mt-2 text-2xl font-rounded tracking-wider">初期設定</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          宗派や郵便口座など、運用の土台となる情報を順を追って設定します。
        </p>
      </div>

      <div className="rounded border border-border bg-surface p-6">
        <SetupWizard
          initialValues={{
            name: tenant.name,
            headPriestName: tenant.headPriestName ?? '',
            sect: tenant.sect ?? '',
            postalAccountName: tenant.postalAccountName ?? '',
            postalAccountSymbol: tenant.postalAccountSymbol ?? '',
            postalAccountNumber: tenant.postalAccountNumber ?? '',
            postalTransferNote: tenant.postalTransferNote ?? '',
          }}
        />
      </div>
    </div>
  );
}
