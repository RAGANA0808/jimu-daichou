'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Button, buttonVariants } from '@/components/ui';
import { cn } from '@/lib/utils';

type HouseholdActionBarProps = {
  householdId: string;
  /** スクロール先の対応履歴セクションの DOM id。page 側で同じ id を付けること。 */
  interactionAnchorId?: string;
  /** 対応履歴を含むタブの URL クエリ (?tab=) の値。指定時はそのタブへ切替えてからスクロールする。 */
  interactionTabValue?: string;
  /** タブ状態を載せる URL クエリのキー。既定 "tab"。 */
  tabParamKey?: string;
};

type BarAction =
  | {
      type: 'link';
      key: string;
      label: string;
      href: string;
      icon: ReactNode;
      primary?: boolean;
    }
  | {
      type: 'button';
      key: string;
      label: string;
      onClick: () => void;
      icon: ReactNode;
    };

const ICON_CLASS = 'h-5 w-5';

function IconRecord() {
  return (
    <svg className={ICON_CLASS} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function IconHouyou() {
  return (
    <svg className={ICON_CLASS} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function IconKaikei() {
  return (
    <svg className={ICON_CLASS} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function IconKazoku() {
  return (
    <svg className={ICON_CLASS} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M19 4a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconFurikae() {
  return (
    <svg className={ICON_CLASS} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M9 13h6M9 17h6" />
    </svg>
  );
}

function IconEdit() {
  return (
    <svg className={ICON_CLASS} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

export function HouseholdActionBar({
  householdId,
  interactionAnchorId = 'interaction-history',
  interactionTabValue,
  tabParamKey = 'tab',
}: HouseholdActionBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function scrollToInteraction() {
    const scroll = () => {
      const el = document.getElementById(interactionAnchorId);
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    // タブ化されている場合、対応履歴タブが hidden だと scroll が効かないため、
    // 先に該当タブへ URL を切替え、表示反映後 (次フレーム) にスクロールする。
    if (interactionTabValue && searchParams.get(tabParamKey) !== interactionTabValue) {
      const params = new URLSearchParams(searchParams.toString());
      params.set(tabParamKey, interactionTabValue);
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      requestAnimationFrame(() => requestAnimationFrame(scroll));
      return;
    }
    scroll();
  }

  const actions: BarAction[] = [
    {
      type: 'button',
      key: 'record',
      label: '対応を記録',
      onClick: scrollToInteraction,
      icon: <IconRecord />,
    },
    {
      type: 'link',
      key: 'houyou',
      label: '法要を登録',
      href: `/houyou/new?householdId=${householdId}`,
      icon: <IconHouyou />,
    },
    {
      type: 'link',
      key: 'kaikei',
      label: '入出金を登録',
      href: `/kaikei/new?householdId=${householdId}`,
      icon: <IconKaikei />,
    },
    {
      type: 'link',
      key: 'kazoku',
      label: '家族を追加',
      href: `/danshintoto/${householdId}/kazoku/new`,
      icon: <IconKazoku />,
    },
    {
      type: 'link',
      key: 'furikae',
      label: '郵便振替用紙',
      href: `/furikae/household/${householdId}`,
      icon: <IconFurikae />,
    },
    {
      type: 'link',
      key: 'edit',
      label: '編集',
      href: `/danshintoto/${householdId}/edit`,
      icon: <IconEdit />,
    },
  ];

  const itemClass = 'shrink-0 flex-col gap-0.5 px-3 md:flex-row md:gap-2';

  return (
    <nav
      aria-label="この世帯のクイック操作"
      className="sticky bottom-0 z-30 -mx-4 mt-2 border-t border-border bg-surface/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-surface/80"
    >
      <div className="flex items-center gap-2 overflow-x-auto md:justify-end md:overflow-visible [-ms-overflow-style:none] [scrollbar-width:none]">
        {actions.map((a) =>
          a.type === 'link' ? (
            <Link
              key={a.key}
              href={a.href}
              className={cn(
                buttonVariants({
                  variant: a.primary ? 'primary' : 'secondary',
                  size: 'sm',
                }),
                itemClass,
              )}
            >
              <span aria-hidden>{a.icon}</span>
              <span>{a.label}</span>
            </Link>
          ) : (
            <Button
              key={a.key}
              variant="primary"
              size="sm"
              onClick={a.onClick}
              className={itemClass}
            >
              <span aria-hidden>{a.icon}</span>
              <span>{a.label}</span>
            </Button>
          ),
        )}
      </div>
    </nav>
  );
}
