import Link from 'next/link';
import { notFound } from 'next/navigation';
import { disconnectGoogleCalendarAction } from '@/features/google/actions';
import { getCurrentTenant } from '@/features/settings/queries';
import { getCurrentUserProfile } from '@/features/account/queries';
import { userRoleLabel } from '@/features/account/roles';

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">
        {value && value.length > 0 ? (
          value
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </dd>
    </>
  );
}

const GOOGLE_CONNECT_MESSAGES: Record<
  string,
  { tone: 'success' | 'error' | 'info'; text: string }
> = {
  success: { tone: 'success', text: 'Google Calendar との連携が完了しました。' },
  disconnected: { tone: 'info', text: 'Google Calendar との連携を解除しました。' },
  error: {
    tone: 'error',
    text: 'Google Calendar の連携に失敗しました。再度お試しください。',
  },
};

const ERROR_REASON_DETAILS: Record<string, string> = {
  invalid_state:
    'CSRF 保護のチェックに失敗しました。ブラウザを閉じずに最初からやり直してください。',
  no_refresh_token:
    'リフレッシュトークンが発行されませんでした。Google アカウントの「セキュリティ → アプリのアクセス」からこのアプリの連携を解除後、再度お試しください。',
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    google_connect?: string;
    reason?: string;
    account?: string;
  }>;
}) {
  const tenant = await getCurrentTenant();
  if (!tenant) {
    notFound();
  }

  const profile = await getCurrentUserProfile();

  const sp = await searchParams;
  const status = sp.google_connect ?? null;
  const reason = sp.reason ?? null;
  const message = status ? GOOGLE_CONNECT_MESSAGES[status] : null;
  const reasonDetail = reason ? ERROR_REASON_DETAILS[reason] : null;
  const accountUpdated = sp.account === 'updated';

  const isConnected = tenant.googleRefreshToken !== null;

  return (
    <div className="space-y-6">
      <div>
        <nav className="text-sm text-muted-foreground">
          <Link href="/dashboard" className="hover:underline">
            ダッシュボード
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">設定</span>
        </nav>
        <div className="mt-2 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-rounded tracking-wider">設定</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              寺院情報と外部連携を管理します。
            </p>
          </div>
          <Link
            href="/settings/edit"
            className="rounded border border-border px-4 py-2 text-sm text-foreground hover:bg-muted"
          >
            寺院情報を編集
          </Link>
        </div>
      </div>

      {message && (
        <p
          role={message.tone === 'error' ? 'alert' : 'status'}
          className={
            message.tone === 'success'
              ? 'rounded bg-green-50 px-3 py-2 text-sm text-green-800'
              : message.tone === 'error'
                ? 'rounded bg-red-50 px-3 py-2 text-sm text-red-800'
                : 'rounded bg-blue-50 px-3 py-2 text-sm text-blue-800'
          }
        >
          {message.text}
          {reasonDetail && (
            <span className="mt-1 block text-xs">{reasonDetail}</span>
          )}
        </p>
      )}

      {accountUpdated && (
        <p
          role="status"
          className="rounded bg-green-50 px-3 py-2 text-sm text-green-800"
        >
          表示名を更新しました。
        </p>
      )}

      <div className="rounded border border-border bg-surface p-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-medium">アカウント</h2>
          <Link
            href="/settings/account"
            className="rounded border border-border px-4 py-2 text-sm text-foreground hover:bg-muted"
          >
            表示名を編集
          </Link>
        </div>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3">
          <DetailRow label="表示名" value={profile.displayName} />
          <DetailRow label="メールアドレス" value={profile.email} />
          <DetailRow label="役割" value={userRoleLabel(profile.role)} />
        </dl>
      </div>

      {profile.role === 'HEAD_PRIEST' && (
        <div className="rounded border border-border bg-surface p-6">
          <h2 className="text-lg font-medium">管理 (住職のみ)</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            寺族の役割管理と、重要な操作の履歴を確認できます。
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/settings/roles"
              className="rounded border border-border px-4 py-2 text-sm text-foreground hover:bg-muted"
            >
              役割管理
            </Link>
            <Link
              href="/settings/audit-log"
              className="rounded border border-border px-4 py-2 text-sm text-foreground hover:bg-muted"
            >
              操作履歴
            </Link>
          </div>
        </div>
      )}

      <div className="rounded border border-border bg-surface p-6">
        <h2 className="text-lg font-medium">寺院情報</h2>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3">
          <DetailRow label="寺院名" value={tenant.name} />
          <DetailRow label="住職氏名" value={tenant.headPriestName} />
          <DetailRow label="URL スラッグ" value={tenant.slug} />
        </dl>
      </div>

      <div className="rounded border border-border bg-surface p-6">
        <h2 className="text-lg font-medium">Google Calendar 連携</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          連携すると、法要を追加・編集すると Google カレンダーに自動で予定が反映されます。
          準備状況を「中止」に変更するとカレンダーから削除されます。
        </p>

        <div className="mt-5">
          {isConnected ? (
            <div className="space-y-3">
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
                <dt className="text-muted-foreground">連携アカウント</dt>
                <dd className="text-foreground">
                  {tenant.googleConnectedEmail ?? (
                    <span className="text-muted-foreground">—</span>
                  )}
                </dd>
                <dt className="text-muted-foreground">連携日時</dt>
                <dd className="text-foreground">
                  {tenant.googleConnectedAt
                    ? `${tenant.googleConnectedAt.getFullYear()}/${tenant.googleConnectedAt.getMonth() + 1}/${tenant.googleConnectedAt.getDate()}`
                    : '—'}
                </dd>
              </dl>
              <form action={disconnectGoogleCalendarAction}>
                <button
                  type="submit"
                  className="rounded border border-red-300 bg-surface px-4 py-2 text-sm text-red-800 hover:bg-red-100"
                >
                  連携を解除する
                </button>
              </form>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-foreground">
                現在 Google Calendar と連携していません。
              </p>
              <a
                href="/api/google/auth/connect"
                className="inline-block inline-flex min-h-touch items-center rounded bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-hover"
              >
                Google Calendar に接続する
              </a>
            </div>
          )}
        </div>
      </div>

      <div className="rounded border border-border bg-surface p-6 text-sm text-muted-foreground">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
          <dt>テナント ID</dt>
          <dd className="font-mono text-xs">{tenant.id}</dd>
          <dt>作成日</dt>
          <dd>
            {tenant.createdAt.getFullYear()}/{tenant.createdAt.getMonth() + 1}/
            {tenant.createdAt.getDate()}
          </dd>
        </dl>
      </div>
    </div>
  );
}
