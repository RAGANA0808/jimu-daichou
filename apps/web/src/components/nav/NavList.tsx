'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { NavIcon } from './NavIcon';
import { NAV_GROUPS, isNavItemActive } from './nav-items';

/**
 * サイドバー / ドロワー共有のナビ本体。
 * - usePathname で現在地を判定し aria-current="page" を付与。
 * - 現在地は brand-soft 背景 + 左端 4px の橙インジケータで色以外でも識別可能 (E13)。
 * - 各リンクは min-h-touch (44px) を維持。密度はグループ間 gap と見出しで出す。
 */
export function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="主要メニュー" className="flex flex-col gap-4 py-3">
      {NAV_GROUPS.map((group) => (
        <div key={group.id} className="flex flex-col gap-0.5">
          {group.label && (
            <h2 className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {group.label}
            </h2>
          )}
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = isNavItemActive(pathname, item);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    onClick={onNavigate}
                    className={cn(
                      'relative flex min-h-touch items-center gap-3 rounded-md px-3 text-base text-foreground transition-colors hover:bg-brand-soft hover:text-brand-soft-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info',
                      active &&
                        'bg-brand-soft font-semibold text-brand-soft-foreground',
                    )}
                  >
                    {active && (
                      <span
                        aria-hidden="true"
                        className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r bg-brand"
                      />
                    )}
                    <NavIcon
                      name={item.icon}
                      className={cn(
                        'h-5 w-5 shrink-0',
                        active ? 'text-brand' : 'text-muted-foreground',
                      )}
                    />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
