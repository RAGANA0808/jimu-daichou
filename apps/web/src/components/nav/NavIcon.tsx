import type { SVGProps } from 'react';

/**
 * ナビ用インライン SVG アイコン群。
 * - 24px / stroke="currentColor" の線アイコン。外部アイコンライブラリ依存を増やさない。
 * - 装飾なので aria-hidden を付与し、ラベル文字を正とする。
 */
export type NavIconName =
  | 'home'
  | 'users'
  | 'book'
  | 'calendar-check'
  | 'flame'
  | 'grid'
  | 'yen'
  | 'bar-chart'
  | 'hand-coin'
  | 'receipt'
  | 'transfer'
  | 'envelope'
  | 'download'
  | 'upload'
  | 'gear';

const PATHS: Record<NavIconName, React.ReactNode> = {
  home: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
      <path d="M9.5 21v-6h5v6" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.2a3.2 3.2 0 0 1 0 6" />
      <path d="M17.5 14.5a5.5 5.5 0 0 1 3 5" />
    </>
  ),
  book: (
    <>
      <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15.5H6.5A1.5 1.5 0 0 0 5 20V4.5Z" />
      <path d="M5 18.5A1.5 1.5 0 0 0 6.5 21H19" />
      <path d="M9 7.5h6M9 11h6" />
    </>
  ),
  'calendar-check': (
    <>
      <rect x="3.5" y="4.5" width="17" height="16" rx="2" />
      <path d="M3.5 9h17M8 3v3M16 3v3" />
      <path d="m8.5 14.5 2.2 2.2 4.3-4.3" />
    </>
  ),
  flame: (
    <>
      <path d="M12 3c.8 2.6-1.5 3.8-1.5 6 0 1.2.8 2 .8 2S10 10.5 9 12c-1.2 1.8-1 5 3 8 4-3 4.2-6.2 3-8-1-1.5-2.3-1-2.3-1s.8-.8.8-2c0-2.6-2.5-3.4-1.5-6Z" />
    </>
  ),
  grid: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1" />
    </>
  ),
  yen: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 7.5 3.5 4.5 3.5-4.5" />
      <path d="M12 12v5M9 13.5h6M9 16h6" />
    </>
  ),
  'bar-chart': (
    <>
      <path d="M4 20h16" />
      <path d="M7 20v-7M12 20V6M17 20v-10" />
    </>
  ),
  'hand-coin': (
    <>
      <circle cx="16.5" cy="7" r="3" />
      <path d="M3 13.5 6 12a3 3 0 0 1 1.6-.4H11a1.5 1.5 0 0 1 0 3H8.5" />
      <path d="m3 13.5 5 5 6-1.5c2.5-.6 3.5-1.5 5-3.5" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 3h12v18l-2-1.3L14 21l-2-1.3L10 21l-2-1.3L6 21V3Z" />
      <path d="M9 8h6M9 11.5h6" />
    </>
  ),
  transfer: (
    <>
      <path d="M4 8h13M14 5l3 3-3 3" />
      <path d="M20 16H7M10 13l-3 3 3 3" />
    </>
  ),
  envelope: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 6.5 8.5 6.5 8.5-6.5" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v11M8.5 10.5 12 14l3.5-3.5" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </>
  ),
  upload: (
    <>
      <path d="M12 14V3M8.5 6.5 12 3l3.5 3.5" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6M18.7 18.7l-1.6-1.6M6.9 6.9 5.3 5.3" />
    </>
  ),
};

export function NavIcon({
  name,
  className,
  ...props
}: { name: NavIconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      {PATHS[name]}
    </svg>
  );
}
