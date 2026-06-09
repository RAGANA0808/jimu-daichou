import Link from 'next/link';
import { createHouseholdAction } from '@/features/danshintoto/actions';
import { HouseholdWizard } from '@/features/danshintoto/HouseholdWizard';

export default function KantanNewHouseholdPage() {
  return (
    <div className="space-y-6">
      <div>
        <nav className="text-sm text-muted-foreground">
          <Link href="/danshintoto" className="hover:underline">
            檀信徒カルテ
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">かんたん登録</span>
        </nav>
        <h1 className="mt-2 text-2xl font-rounded tracking-wider">
          かんたん登録
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          施主名とふりがなだけで登録できます。連絡先は後からでも追記できます。
        </p>
      </div>

      <div className="rounded border border-border bg-surface p-6">
        <HouseholdWizard
          action={createHouseholdAction}
          cancelHref="/danshintoto"
        />
      </div>
    </div>
  );
}
