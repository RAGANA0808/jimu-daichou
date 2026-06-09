import Link from 'next/link';
import { createCircuitTourAction } from '@/features/junkai/actions';
import { TourForm } from '@/features/junkai/TourForm';
import { listActiveUsersForAssignee } from '@/features/junkai/queries';

export default async function NewCircuitTourPage() {
  const assignees = await listActiveUsersForAssignee();

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
          <span className="text-foreground">新規登録</span>
        </nav>
        <h1 className="mt-2 text-2xl font-rounded tracking-wider">
          巡回を登録する
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          棚経・月参りなどの巡回予定を追加します。訪問先は登録後に並べ替えできます。
        </p>
      </div>

      <div className="rounded border border-border bg-surface p-6">
        <TourForm
          action={createCircuitTourAction}
          submitLabel="登録する"
          cancelHref="/junkai"
          redirectTo="/junkai"
          assignedUserOptions={assignees}
        />
      </div>
    </div>
  );
}
