import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';

/**
 * ルート共通の 404 画面 (App Router not-found.tsx)。
 */
export default function NotFound() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-12 w-12 text-muted-foreground"
        fill="currentColor"
      >
        <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-3.5 7a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm5 0a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0ZM8 16a4 4 0 0 1 8 0 .75.75 0 0 1-1.5 0 2.5 2.5 0 0 0-5 0A.75.75 0 0 1 8 16Z" />
      </svg>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">
          お探しのページが見つかりませんでした。
        </h1>
        <p className="text-base text-muted-foreground">
          ページが移動または削除された可能性がございます。
        </p>
      </div>
      <Link href="/dashboard" className={buttonVariants()}>
        ダッシュボードへ戻る
      </Link>
    </div>
  );
}
