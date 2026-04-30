import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PREPARATION_STATUS_LABELS } from '@/features/houyou/types';
import { getMemorialServiceById } from '@/features/houyou/queries';

function formatJstDateTime(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}/${m}/${day} ${hh}:${mm}`;
}

function formatJaDate(d: Date): string {
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

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

export default async function MemorialServiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const service = await getMemorialServiceById(id);
  if (!service) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <nav className="text-sm text-gray-500">
          <Link href="/dashboard" className="hover:underline">
            ダッシュボード
          </Link>
          <span className="mx-2">/</span>
          <Link href="/houyou" className="hover:underline">
            法要
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-700">{service.serviceName}</span>
        </nav>
        <div className="mt-2 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-serif tracking-wider">
              {service.serviceName}
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              <Link
                href={`/danshintoto/${service.household.id}`}
                className="hover:underline"
              >
                {service.household.householderName}
              </Link>
              家
            </p>
          </div>
          <Link
            href={`/houyou/${service.id}/edit`}
            className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            編集
          </Link>
        </div>
      </div>

      <div className="rounded border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-medium">日時・場所</h2>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3">
          <DetailRow
            label="予定日時"
            value={formatJstDateTime(service.scheduledAt)}
          />
          <DetailRow label="場所" value={service.location} />
          <DetailRow
            label="準備状況"
            value={PREPARATION_STATUS_LABELS[service.preparationStatus]}
          />
        </dl>
      </div>

      <div className="rounded border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-medium">詳細</h2>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3">
          <DetailRow
            label="参列人数"
            value={
              service.attendeeCount !== null
                ? `${service.attendeeCount} 人`
                : null
            }
          />
          <DetailRow
            label="塔婆本数"
            value={
              service.tobaCount !== null ? `${service.tobaCount} 本` : null
            }
          />
          <DetailRow
            label="御布施額"
            value={
              service.offeringAmount !== null
                ? `${service.offeringAmount.toLocaleString('ja-JP')} 円`
                : null
            }
          />
        </dl>
      </div>

      <div className="rounded border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-medium">備考</h2>
        <div className="mt-3 whitespace-pre-wrap text-sm text-gray-900">
          {service.memo && service.memo.length > 0 ? (
            service.memo
          ) : (
            <span className="text-gray-400">—</span>
          )}
        </div>
      </div>

      <div className="rounded border border-gray-200 bg-white p-6 text-sm">
        <h2 className="text-base font-medium text-gray-900">Google Calendar</h2>
        <p className="mt-2 text-gray-600">
          {service.googleCalendarEventId ? (
            <>
              ✓ このイベントは Google カレンダーと同期されています。
              <br />
              編集内容は自動で反映されます。
            </>
          ) : (
            <>
              このイベントはまだ Google カレンダーに同期されていません。
              <br />
              <Link href="/settings" className="text-gray-700 underline">
                設定ページ
              </Link>
              で連携設定をご確認ください。連携済みで編集保存すると同期されます。
            </>
          )}
        </p>
      </div>

      <div className="rounded border border-gray-200 bg-white p-6 text-sm text-gray-500">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
          <dt>登録日</dt>
          <dd>{formatJaDate(service.createdAt)}</dd>
          <dt>最終更新</dt>
          <dd>{formatJaDate(service.updatedAt)}</dd>
          <dt>法要 ID</dt>
          <dd className="font-mono text-xs">{service.id}</dd>
        </dl>
      </div>
    </div>
  );
}
