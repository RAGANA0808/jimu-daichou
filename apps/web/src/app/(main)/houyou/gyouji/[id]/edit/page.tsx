import Link from 'next/link';
import { notFound } from 'next/navigation';
import { updateTempleEventAction } from '@/features/gyouji/actions';
import { TempleEventForm } from '@/features/gyouji/TempleEventForm';
import { SoftDeleteTempleEventButton } from '@/features/gyouji/SoftDeleteTempleEventButton';
import { getTempleEventById } from '@/features/gyouji/queries';

function toDatetimeLocalString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

export default async function EditTempleEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await getTempleEventById(id);
  if (!event) {
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
          <Link href="/houyou" className="hover:underline">
            法要
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">寺の行事</span>
          <span className="mx-2">/</span>
          <span className="text-foreground">編集</span>
        </nav>
        <h1 className="mt-2 text-2xl font-rounded tracking-wider">
          寺の行事を編集する
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{event.title}</p>
      </div>

      <div className="rounded border border-border bg-surface p-6">
        <TempleEventForm
          action={updateTempleEventAction}
          submitLabel="保存する"
          templeEventId={event.id}
          cancelHref="/houyou"
          initialValues={{
            title: event.title,
            scheduledAt: toDatetimeLocalString(event.scheduledAt),
            endTime: event.endTime
              ? toDatetimeLocalString(event.endTime)
              : '',
            location: event.location ?? '',
            memo: event.memo ?? '',
          }}
        />
      </div>

      <div className="rounded border border-border bg-surface p-6">
        <h2 className="text-base font-medium text-foreground">行事の除外</h2>
        <p className="mt-1 mb-3 text-sm text-muted-foreground">
          一覧から外したい場合はこちらから除外できます。記録は保持されます。
        </p>
        <SoftDeleteTempleEventButton
          templeEventId={event.id}
          title={event.title}
        />
      </div>
    </div>
  );
}
