'use client';

import { Button } from '@/components/ui/button';

/**
 * ルート共通のエラー画面 (App Router error.tsx)。
 * 個人情報の流出を避けるため、画面には詳細を出さず定型メッセージのみ表示する。
 * 詳細ログは Next.js のサーバ側出力に委ね、ここではクライアントで何も出力しない
 * (個人情報が error.message に混入してもログへ流さないため)。
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-12 w-12 text-danger"
        fill="currentColor"
      >
        <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1 5a1 1 0 1 1 2 0v6a1 1 0 1 1-2 0V7Zm1 11.25A1.25 1.25 0 1 1 12 15.75a1.25 1.25 0 0 1 0 2.5Z" />
      </svg>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">
          申し訳ございません。問題が発生いたしました。
        </h1>
        <p className="text-base text-muted-foreground">
          お手数ですが、もう一度お試しください。続く場合は管理者へご連絡ください。
        </p>
        {error.digest && (
          <p className="text-sm text-muted-foreground">
            参照番号: {error.digest}
          </p>
        )}
      </div>
      <Button onClick={reset}>もう一度試す</Button>
    </div>
  );
}
