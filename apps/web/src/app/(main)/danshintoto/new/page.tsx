import Link from 'next/link';
import { createHouseholdAction } from '@/features/danshintoto/actions';
import { HouseholdForm } from '@/features/danshintoto/HouseholdForm';

export default function NewHouseholdPage() {
  return (
    <div className="space-y-6">
      <div>
        <nav className="text-sm text-muted-foreground">
          <Link href="/danshintoto" className="hover:underline">
            檀信徒カルテ
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">新規登録</span>
        </nav>
        <h1 className="mt-2 text-2xl font-rounded tracking-wider">
          世帯を登録する
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          施主名とふりがなが必須です。その他の項目は後からでも追記できます。
        </p>
        <p className="mt-2 text-sm">
          <Link
            href="/danshintoto/new/kantan"
            className="text-info underline-offset-4 hover:underline"
          >
            お名前だけで登録できる「かんたん登録」もご利用いただけます →
          </Link>
        </p>
      </div>

      <div className="rounded border border-border bg-surface p-6">
        <HouseholdForm
          action={createHouseholdAction}
          submitLabel="登録する"
          cancelHref="/danshintoto"
        />
      </div>
    </div>
  );
}
