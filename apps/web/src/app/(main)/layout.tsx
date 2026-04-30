import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { signOutAction } from '@/lib/auth/actions';

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

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link
            href="/dashboard"
            className="font-serif tracking-wider hover:text-gray-600"
          >
            寺務台帳
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link
              href="/dashboard"
              className="text-gray-700 hover:text-gray-900 hover:underline"
            >
              ダッシュボード
            </Link>
            <Link
              href="/settings"
              className="text-gray-700 hover:text-gray-900 hover:underline"
            >
              設定
            </Link>
            <span className="text-gray-300">|</span>
            <span className="text-gray-700">{user.displayName} さん</span>
            <form action={signOutAction}>
              <button
                type="submit"
                className="rounded border border-gray-300 px-3 py-1 text-gray-700 hover:bg-gray-100"
              >
                ログアウト
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-8">{children}</div>
      </main>
    </div>
  );
}
