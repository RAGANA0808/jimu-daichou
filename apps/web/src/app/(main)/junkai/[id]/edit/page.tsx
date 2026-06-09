import Link from 'next/link';
import { notFound } from 'next/navigation';
import { can, getCurrentRole } from '@/lib/auth';
import { updateCircuitTourAction } from '@/features/junkai/actions';
import { TourForm } from '@/features/junkai/TourForm';
import { SoftDeleteCircuitTourButton } from '@/features/junkai/SoftDeleteCircuitTourButton';
import {
  getCircuitTourById,
  listActiveUsersForAssignee,
} from '@/features/junkai/queries';

/** @db.Date (UTC0時保存) を input[type=date] 用の YYYY-MM-DD に整形する (getUTC* で読む)。 */
function toDateInputString(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default async function EditCircuitTourPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [tour, role, assignees] = await Promise.all([
    getCircuitTourById(id),
    getCurrentRole(),
    listActiveUsersForAssignee(),
  ]);
  if (!tour) {
    notFound();
  }
  const canSoftDelete = role !== null && can(role, 'softDelete');

  return (
    <div className="space-y-6">
      <div>
        <nav className="text-sm text-muted-foreground">
          <Link href="/dashboard" className="hover:underline">
            ダッシュボード
          </Link>
          <span className="mx-2">/</span>
          <Link href="/junkai" className="hover:underline">
            巡回
          </Link>
          <span className="mx-2">/</span>
          <Link href={`/junkai/${tour.id}`} className="hover:underline">
            {tour.title}
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">編集</span>
        </nav>
        <h1 className="mt-2 text-2xl font-rounded tracking-wider">
          巡回を編集する
        </h1>
      </div>

      <div className="rounded border border-border bg-surface p-6">
        <TourForm
          action={updateCircuitTourAction}
          submitLabel="更新する"
          circuitTourId={tour.id}
          cancelHref={`/junkai/${tour.id}`}
          redirectTo={`/junkai/${tour.id}`}
          assignedUserOptions={assignees}
          initialValues={{
            title: tour.title,
            tourType: tour.tourType,
            scheduledDate: toDateInputString(tour.scheduledDate),
            assignedUserId: tour.assignedUserId ?? '',
            memo: tour.memo ?? '',
          }}
        />
      </div>

      {canSoftDelete && (
        <div className="rounded border border-border bg-surface p-6">
          <h2 className="text-base font-medium text-foreground">巡回の除外</h2>
          <p className="mt-1 mb-3 text-sm text-muted-foreground">
            一覧から外したい場合はこちらから除外できます。記録は保持されます。
          </p>
          <SoftDeleteCircuitTourButton
            circuitTourId={tour.id}
            title={tour.title}
          />
        </div>
      )}
    </div>
  );
}
