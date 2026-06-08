import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PREPARATION_STATUS_LABELS } from '@/features/houyou/types';
import { getMemorialServiceById } from '@/features/houyou/queries';
import {
  listTargetPersonCandidates,
  listTobasByMemorialService,
} from '@/features/toba/queries';
import {
  TobaManager,
  type TobaListItem,
} from '@/features/toba/TobaManager';

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

/** 終了予定の表示。開始と同日なら時刻のみ、別日なら日付込みで返す。 */
function formatEndTime(scheduledAt: Date, endTime: Date): string {
  const sameDay =
    scheduledAt.getFullYear() === endTime.getFullYear() &&
    scheduledAt.getMonth() === endTime.getMonth() &&
    scheduledAt.getDate() === endTime.getDate();
  const hh = String(endTime.getHours()).padStart(2, '0');
  const mm = String(endTime.getMinutes()).padStart(2, '0');
  return sameDay ? `${hh}:${mm}` : formatJstDateTime(endTime);
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

  const [tobaRecords, targetPersons] = await Promise.all([
    listTobasByMemorialService(id),
    listTargetPersonCandidates(service.household.id),
  ]);

  const tobas: TobaListItem[] = tobaRecords.map((t) => ({
    id: t.id,
    applicantName: t.applicantName,
    targetPersonName: t.targetPerson?.name ?? null,
    targetPersonId: t.targetPersonId,
    count: t.count,
    inscription: t.inscription,
    offeringAmount: t.offeringAmount,
    memo: t.memo,
  }));

  const targetPersonOptions = targetPersons.map((p) => ({
    id: p.id,
    name: p.name,
  }));

  return (
    <div className="space-y-6">
      <div>
        <nav className="text-sm text-muted-foreground">
          <Link href="/dashboard" className="hover:underline">
            ダッシュボード
          </Link>
          <span className="mx-2">/</span>
          <Link href="/houyou" className="hover:underline">
            法要
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">{service.serviceName}</span>
        </nav>
        <div className="mt-2 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-rounded tracking-wider">
              {service.serviceName}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
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
            className="rounded border border-border px-4 py-2 text-sm text-foreground hover:bg-muted"
          >
            編集
          </Link>
        </div>
      </div>

      <div className="rounded border border-border bg-surface p-6">
        <h2 className="text-lg font-medium">日時・場所</h2>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3">
          <DetailRow
            label="予定日時"
            value={formatJstDateTime(service.scheduledAt)}
          />
          <DetailRow
            label="終了予定"
            value={
              service.endTime
                ? formatEndTime(service.scheduledAt, service.endTime)
                : null
            }
          />
          <DetailRow label="場所" value={service.location} />
          <DetailRow
            label="準備状況"
            value={PREPARATION_STATUS_LABELS[service.preparationStatus]}
          />
        </dl>
      </div>

      <div className="rounded border border-border bg-surface p-6">
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
            label="塔婆本数 (概算)"
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

      <TobaManager
        memorialServiceId={service.id}
        tobas={tobas}
        targetPersons={targetPersonOptions}
      />

      <div className="rounded border border-border bg-surface p-6">
        <h2 className="text-lg font-medium">備考</h2>
        <div className="mt-3 whitespace-pre-wrap text-sm text-foreground">
          {service.memo && service.memo.length > 0 ? (
            service.memo
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </div>
      </div>

      <div className="rounded border border-border bg-surface p-6 text-sm">
        <h2 className="text-base font-medium text-foreground">Google Calendar</h2>
        <p className="mt-2 text-muted-foreground">
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
              <Link href="/settings" className="text-foreground underline">
                設定ページ
              </Link>
              で連携設定をご確認ください。連携済みで編集保存すると同期されます。
            </>
          )}
        </p>
      </div>

      <div className="rounded border border-border bg-surface p-6 text-sm text-muted-foreground">
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
