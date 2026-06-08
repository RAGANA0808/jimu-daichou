import { NavList } from './NavList';

/**
 * desktop (lg 以上) 固定左サイドバー。
 * レイアウト側で sticky / 高さ / 表示制御 (hidden lg:flex) を担い、
 * ここは中身 (NavList) の配置のみを持つ。
 */
export function Sidebar() {
  return (
    <div className="flex h-full flex-col px-2">
      <NavList />
    </div>
  );
}
