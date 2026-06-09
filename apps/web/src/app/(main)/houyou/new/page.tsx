import Link from 'next/link';
import { createMemorialServiceAction } from '@/features/houyou/actions';
import { MemorialServiceForm } from '@/features/houyou/MemorialServiceForm';
import { getHouseholdById } from '@/features/danshintoto/queries';
import { isValidUuid } from '@/lib/db';

export default async function NewMemorialServicePage({
  searchParams,
}: {
  searchParams: Promise<{ householdId?: string }>;
}) {
  const { householdId } = await searchParams;

  const household =
    householdId && isValidUuid(householdId)
      ? await getHouseholdById(householdId)
      : null;

  if (!household) {
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
            <span className="text-foreground">新規登録</span>
          </nav>
          <h1 className="mt-2 text-2xl font-rounded tracking-wider">
            法要を登録する
          </h1>
        </div>
        <div className="rounded border border-warning/30 bg-warning-soft p-6">
          <p className="text-sm text-warning">
            法要はまず対象の世帯を選んでからご登録ください。
          </p>
          <div className="mt-3">
            <Link
              href="/danshintoto"
              className="inline-flex min-h-touch items-center rounded bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-hover"
            >
              檀信徒カルテを開く
            </Link>
          </div>
        </div>
      </div>
    );
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
          <Link
            href={`/danshintoto/${household.id}`}
            className="hover:underline"
          >
            {household.householderName}
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">新規登録</span>
        </nav>
        <h1 className="mt-2 text-2xl font-rounded tracking-wider">
          法要を登録する
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {household.householderName} 家の法要予定を追加します。
        </p>
      </div>

      <div className="rounded border border-border bg-surface p-6">
        <MemorialServiceForm
          action={createMemorialServiceAction}
          submitLabel="登録する"
          householdId={household.id}
          cancelHref={`/danshintoto/${household.id}`}
        />
      </div>
    </div>
  );
}
