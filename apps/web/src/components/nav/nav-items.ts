import type { NavIconName } from './NavIcon';

export type NavItem = {
  href: string;
  label: string;
  icon: NavIconName;
  /**
   * true のとき、現在地判定で前方一致 (startsWith) を使わず完全一致のみとする。
   * 例: /kaikei は /kaikei/shukei (集計) を子に持つため、集計ページで会計まで
   * 二重にハイライトされるのを防ぐ。
   */
  exact?: boolean;
};

export type NavGroup = {
  id: string;
  /** null = 見出しなしの単独群 (ダッシュボード・設定)。 */
  label: string | null;
  items: NavItem[];
};

/**
 * ナビの唯一の真実 (single source of truth)。
 * Sidebar / MobileNav 双方がこれを描画し、項目ズレを防ぐ。
 * 実在ルートのみを掲載する (デッドリンク禁止)。
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'top',
    label: null,
    items: [{ href: '/dashboard', label: 'ダッシュボード', icon: 'home' }],
  },
  {
    id: 'karte',
    label: 'カルテ',
    items: [
      { href: '/danshintoto', label: '檀信徒', icon: 'users' },
      { href: '/kakochou', label: '過去帳', icon: 'book' },
      { href: '/nenki', label: '年忌表', icon: 'calendar-check' },
    ],
  },
  {
    id: 'homu',
    label: '法務',
    items: [
      { href: '/houyou', label: '法要', icon: 'flame' },
      { href: '/junkai', label: '巡回', icon: 'calendar-check' },
      { href: '/kukaku', label: '区画', icon: 'grid' },
    ],
  },
  {
    id: 'kaikei',
    label: '会計',
    items: [
      // /kaikei は /kaikei/shukei を子に持つので完全一致のみ active。
      { href: '/kaikei', label: '会計', icon: 'yen', exact: true },
      { href: '/kaikei/shukei', label: '集計', icon: 'bar-chart' },
      { href: '/gojikai', label: '護持会費', icon: 'hand-coin' },
      { href: '/bochi', label: '墓地管理料', icon: 'receipt' },
      { href: '/furikae', label: '郵便振替', icon: 'transfer' },
    ],
  },
  {
    id: 'unyo',
    label: '運用',
    items: [
      { href: '/hasso', label: '発送', icon: 'envelope' },
      { href: '/import', label: '取込', icon: 'download' },
      { href: '/export', label: '書出', icon: 'upload' },
    ],
  },
  {
    id: 'settings',
    label: null,
    items: [{ href: '/settings', label: '設定', icon: 'gear' }],
  },
];

/**
 * 現在地判定。完全一致を最優先し、exact フラグのない項目は前方一致も許容する。
 * (NavList から共有して desktop/mobile のハイライトを一致させる)
 */
export function isNavItemActive(pathname: string, item: NavItem): boolean {
  if (pathname === item.href) return true;
  if (item.exact) return false;
  return pathname.startsWith(`${item.href}/`);
}
