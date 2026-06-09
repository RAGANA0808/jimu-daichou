import Link from 'next/link';
import { createTempleEventAction } from '@/features/gyouji/actions';
import { TempleEventForm } from '@/features/gyouji/TempleEventForm';

export default function NewTempleEventPage() {
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
          <span className="text-foreground">新規登録</span>
        </nav>
        <h1 className="mt-2 text-2xl font-rounded tracking-wider">
          寺の行事を登録する
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          彼岸会・盂蘭盆会・除夜の鐘など、世帯に紐づかない寺の年中行事を追加します。
        </p>
      </div>

      <div className="rounded border border-border bg-surface p-6">
        <TempleEventForm
          action={createTempleEventAction}
          submitLabel="登録する"
          cancelHref="/houyou"
        />
      </div>
    </div>
  );
}
