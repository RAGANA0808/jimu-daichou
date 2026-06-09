import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentRole } from '@/lib/auth';
import { RoleManagementSection } from '@/features/account/RoleManagementSection';
import { listTenantUsers } from '@/features/account/role-management-queries';

/**
 * 役割管理 (PERMISSION P-2)。住職 (HEAD_PRIEST) のみアクセス可。
 * サーバ側のアクションでも admin ガードしているが、画面到達も住職に限定する。
 */
export default async function RolesPage() {
  const role = await getCurrentRole();
  if (role !== 'HEAD_PRIEST') {
    redirect('/settings');
  }

  const users = await listTenantUsers();

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
          <span className="text-foreground">役割管理</span>
        </nav>
        <h1 className="mt-2 text-2xl font-rounded tracking-wider">役割管理</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          寺族それぞれの役割と、アカウントの有効/無効を管理します。
        </p>
      </div>

      <div className="rounded border border-border bg-surface p-6">
        <RoleManagementSection users={users} />
      </div>
    </div>
  );
}
