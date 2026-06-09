import Link from 'next/link';
import { createGravePlotAreaAction } from '@/features/kukaku/areas/actions';
import { GravePlotAreaForm } from '@/features/kukaku/areas/GravePlotAreaForm';

export default function NewGravePlotAreaPage() {
  return (
    <div className="space-y-6">
      <div>
        <nav className="text-sm text-muted-foreground">
          <Link href="/dashboard" className="hover:underline">
            ダッシュボード
          </Link>
          <span className="mx-2">/</span>
          <Link href="/kukaku" className="hover:underline">
            区画
          </Link>
          <span className="mx-2">/</span>
          <Link href="/kukaku/areas" className="hover:underline">
            エリア
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">新規登録</span>
        </nav>
        <h1 className="mt-2 text-2xl font-rounded tracking-wider">
          区画エリアを登録する
        </h1>
      </div>

      <div className="rounded border border-border bg-surface p-6">
        <GravePlotAreaForm
          action={createGravePlotAreaAction}
          submitLabel="登録する"
          cancelHref="/kukaku/areas"
        />
      </div>
    </div>
  );
}
