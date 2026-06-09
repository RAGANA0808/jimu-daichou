'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { NavList } from './NavList';

/**
 * tablet / mobile (lg 未満) のハンバーガー + 左ドロワー。
 * - ハンバーガーボタンとドロワー本体を 1 コンポーネントで持ち、開閉状態を内包。
 * - role="dialog" aria-modal、Esc / 背景クリック / リンク遷移で閉じる。
 * - 開いている間は body スクロールをロックし、フォーカスをドロワー内に移す。
 * - lg 以上では表示されない (layout 側で lg:hidden、サイドバーが常設)。
 */
export function MobileNav({ children }: { children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  // ルート変化時の保険クローズ (onNavigate 漏れ対策)。
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // 開いている間: body スクロールロック + Esc 閉じ + 初期フォーカス。
  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const firstLink = panelRef.current?.querySelector<HTMLElement>(
      'a, button',
    );
    firstLink?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }
      // Tab をパネル内に閉じ込める (フォーカストラップ)。
      if (e.key === 'Tab' && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;
        const activeEl = document.activeElement;
        if (e.shiftKey && activeEl === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && activeEl === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, close]);

  // 閉じたらトリガーへフォーカスを返す。
  useEffect(() => {
    if (!open) {
      triggerRef.current?.focus({ preventScroll: true });
    }
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="mobile-nav-drawer"
        aria-label="メニューを開く"
        className="inline-flex min-h-touch min-w-touch items-center justify-center rounded-md text-brand-foreground transition-colors hover:bg-surface/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info lg:hidden"
      >
        <svg
          viewBox="0 0 24 24"
          width="24"
          height="24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      {mounted &&
        open &&
        createPortal(
          <div className="fixed inset-0 z-[60] lg:hidden">
            <button
              type="button"
              aria-label="メニューを閉じる"
              onClick={close}
              className="absolute inset-0 bg-ink/40"
              tabIndex={-1}
            />
            <div
              ref={panelRef}
              id="mobile-nav-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="メインメニュー"
              className="absolute left-0 top-0 flex h-full w-72 max-w-[85vw] flex-col overflow-y-auto border-r border-border bg-surface shadow-xl"
            >
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <span className="font-rounded text-lg font-bold tracking-wider text-brand">
                  寺務台帳
                </span>
                <button
                  type="button"
                  onClick={close}
                  aria-label="メニューを閉じる"
                  className="inline-flex min-h-touch min-w-touch items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="22"
                    height="22"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <path d="m6 6 12 12M18 6 6 18" />
                  </svg>
                </button>
              </div>
              <div className="px-2">
                <NavList onNavigate={close} />
              </div>
              {children && (
                <div className={cn('mt-auto border-t border-border px-4 py-4')}>
                  {children}
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
