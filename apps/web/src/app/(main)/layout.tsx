import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { signOutAction } from '@/lib/auth/actions';
import { ToastProvider } from '@/components/ui/toast';
import { FontScaleSwitcher } from '@/components/ui/font-scale-switcher';
import { Button } from '@/components/ui/button';
import { SkipLink } from '@/components/ui/skip-link';
import { SearchBar } from '@/features/search/SearchBar';
import { Sidebar } from '@/components/nav/Sidebar';
import { MobileNav } from '@/components/nav/MobileNav';

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) {
    // middleware で弾いているが、Server Component 側の二重防御。
    redirect('/login');
  }
  if (!user.isActive) {
    // 無効化されたアカウントはアプリを利用できない (PERMISSION P-2)。
    // 最後の HEAD_PRIEST は役割管理側で無効化禁止のため、住職が締め出されることはない。
    redirect('/login?error=deactivated');
  }

  const logoutForm = (
    <form action={signOutAction}>
      <Button
        type="submit"
        variant="secondary"
        size="sm"
        className="w-full border-white/40 bg-transparent text-brand-foreground hover:bg-surface/15 lg:w-auto"
      >
        ログアウト
      </Button>
    </form>
  );

  // ドロワー内に集約する操作 (狭幅ではヘッダーから間引く要素の受け皿)。
  const drawerFooter = (
    <div className="flex flex-col gap-3">
      <span className="text-sm text-muted-foreground">
        {user.displayName} さん
      </span>
      <FontScaleSwitcher />
      <form action={signOutAction}>
        <Button type="submit" variant="secondary" size="sm" className="w-full">
          ログアウト
        </Button>
      </form>
    </div>
  );

  return (
    <ToastProvider>
      <SkipLink />
      <div className="flex min-h-svh flex-col bg-background">
        <header className="sticky top-0 z-40 border-b border-brand-hover bg-brand text-brand-foreground">
          <div className="flex h-[var(--header-h)] items-center gap-3 px-4">
            <MobileNav>{drawerFooter}</MobileNav>
            <Link
              href="/dashboard"
              className="shrink-0 font-rounded text-lg font-bold tracking-wider text-brand-foreground transition-opacity hover:opacity-90"
            >
              寺務台帳
            </Link>
            <div className="flex-1 px-1">
              <div className="mx-auto max-w-xl">
                <SearchBar />
              </div>
            </div>
            <div className="hidden items-center gap-3 text-base sm:flex">
              <FontScaleSwitcher />
              <span className="text-brand-foreground/40" aria-hidden="true">
                |
              </span>
              <span className="text-brand-foreground">
                {user.displayName} さん
              </span>
              {logoutForm}
            </div>
          </div>
        </header>

        <div className="flex flex-1">
          <aside className="hidden w-60 shrink-0 overflow-y-auto border-r border-border bg-surface lg:sticky lg:top-[var(--header-h)] lg:flex lg:h-[calc(100svh_-_var(--header-h))]">
            <Sidebar />
          </aside>
          <main id="main-content" tabIndex={-1} className="min-w-0 flex-1">
            <div className="mx-auto w-full max-w-screen-2xl px-4 py-5 lg:px-6 lg:py-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
