import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentRole } from '@/lib/auth';
import { userRoleLabel } from '@/features/account/roles';
import { auditActionLabel, auditEntityLabel } from '@/features/audit/labels';
import { listAuditLogs } from '@/features/audit/queries';

/** JST で日時を整形する (規約: Asia/Tokyo 表示)。 */
function formatJst(d: Date): string {
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/**
 * 監査ログビューア (PERMISSION P-3)。住職 (HEAD_PRIEST) のみアクセス可。
 * 最新 100 件を新しい順に表示する。個人情報は summary に載らない設計。
 */
export default async function AuditLogPage() {
  const role = await getCurrentRole();
  if (role !== 'HEAD_PRIEST') {
    redirect('/settings');
  }

  const logs = await listAuditLogs();

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
          <span className="text-foreground">操作履歴</span>
        </nav>
        <h1 className="mt-2 text-2xl font-rounded tracking-wider">操作履歴</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          重要な操作の記録です。新しい順に最新 100 件を表示しています。
        </p>
      </div>

      <div className="rounded border border-border bg-surface p-6">
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            まだ操作の記録はありません。
          </p>
        ) : (
          <div className="overflow-x-auto rounded border border-border">
            <table className="w-full divide-y divide-border text-sm">
              <thead className="bg-brand text-left text-xs uppercase tracking-wider text-brand-foreground">
                <tr>
                  <th className="px-4 py-2 whitespace-nowrap">日時</th>
                  <th className="px-4 py-2 whitespace-nowrap">操作者</th>
                  <th className="px-4 py-2 whitespace-nowrap">操作</th>
                  <th className="px-4 py-2 whitespace-nowrap">対象</th>
                  <th className="px-4 py-2">内容</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((log) => (
                  <tr key={log.id} className="align-top hover:bg-muted">
                    <td className="px-4 py-2 whitespace-nowrap text-foreground">
                      {formatJst(log.createdAt)}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-foreground">
                      {log.actorName ?? (
                        <span className="text-muted-foreground">—</span>
                      )}
                      {log.actorRole && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({userRoleLabel(log.actorRole)})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-foreground">
                      {auditActionLabel(log.action)}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-foreground">
                      {auditEntityLabel(log.entityType)}
                    </td>
                    <td className="px-4 py-2 text-foreground">{log.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
