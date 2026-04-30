import Link from 'next/link';
import { notFound } from 'next/navigation';
import { disconnectGoogleCalendarAction } from '@/features/google/actions';
import { getCurrentTenant } from '@/features/settings/queries';

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <>
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-900">
        {value && value.length > 0 ? (
          value
        ) : (
          <span className="text-gray-400">—</span>
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
  searchParams: Promise<{ google_connect?: string; reason?: string }>;
}) {
  const tenant = await getCurrentTenant();
  if (!tenant) {
    notFound();
  }

  const sp = await searchParams;
  const status = sp.google_connect ?? null;
  const reason = sp.reason ?? null;
  const message = status ? GOOGLE_CONNECT_MESSAGES[status] : null;
  const reasonDetail = reason ? ERROR_REASON_DETAILS[reason] : null;

  const isConnected = tenant.googleRefreshToken !== null;

  return (
    <div className="space-y-6">
      <div>
        <nav className="text-sm text-gray-500">
          <Link href="/dashboard" className="hover:underline">
            ダッシュボード
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-700">設定</span>
        </nav>
        <div className="mt-2 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-serif tracking-wider">設定</h1>
            <p className="mt-1 text-sm text-gray-600">
              寺院情報と外部連携を管理します。
            </p>
          </div>
          <Link
            href="/settings/edit"
            className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
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

      <div className="rounded border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-medium">寺院情報</h2>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3">
          <DetailRow label="寺院名" value={tenant.name} />
          <DetailRow label="住職氏名" value={tenant.headPriestName} />
          <DetailRow label="URL スラッグ" value={tenant.slug} />
        </dl>
      </div>

      <div className="rounded border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-medium">Google Calendar 連携</h2>
        <p className="mt-1 text-sm text-gray-600">
          連携すると、法要を追加・編集すると Google カレンダーに自動で予定が反映されます。
          準備状況を「中止」に変更するとカレンダーから削除されます。
        </p>

        <div className="mt-5">
          {isConnected ? (
            <div className="space-y-3">
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
                <dt className="text-gray-500">連携アカウント</dt>
                <dd className="text-gray-900">
                  {tenant.googleConnectedEmail ?? (
                    <span className="text-gray-400">—</span>
                  )}
                </dd>
                <dt className="text-gray-500">連携日時</dt>
                <dd className="text-gray-900">
                  {tenant.googleConnectedAt
                    ? `${tenant.googleConnectedAt.getFullYear()}/${tenant.googleConnectedAt.getMonth() + 1}/${tenant.googleConnectedAt.getDate()}`
                    : '—'}
                </dd>
              </dl>
              <form action={disconnectGoogleCalendarAction}>
                <button
                  type="submit"
                  className="rounded border border-red-300 bg-white px-4 py-2 text-sm text-red-800 hover:bg-red-100"
                >
                  連携を解除する
                </button>
              </form>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-700">
                現在 Google Calendar と連携していません。
              </p>
              <a
                href="/api/google/auth/connect"
                className="inline-block rounded bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800"
              >
                Google Calendar に接続する
              </a>
            </div>
          )}
        </div>
      </div>

      <div className="rounded border border-gray-200 bg-white p-6 text-sm text-gray-500">
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
