'use client';

import Link from 'next/link';

type AreaOption = {
  id: string;
  name: string;
};

type Props = {
  areas: AreaOption[];
  currentAreaId: string;
};

export function AreaTabs({ areas, currentAreaId }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-gray-200">
      {areas.map((a) => {
        const active = a.id === currentAreaId;
        return (
          <Link
            key={a.id}
            href={`/kukaku/map?areaId=${a.id}`}
            className={[
              'rounded-t px-4 py-2 text-sm',
              active
                ? 'border-x border-t border-gray-300 bg-white text-gray-900'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
            ].join(' ')}
          >
            {a.name}
          </Link>
        );
      })}
      <Link
        href="/kukaku/areas"
        className="ml-auto rounded px-3 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700"
      >
        エリア管理
      </Link>
    </div>
  );
}
