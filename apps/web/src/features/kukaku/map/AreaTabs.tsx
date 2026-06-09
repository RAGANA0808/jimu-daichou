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
    <div className="flex flex-wrap items-center gap-1 border-b border-border">
      {areas.map((a) => {
        const active = a.id === currentAreaId;
        return (
          <Link
            key={a.id}
            href={`/kukaku/map?areaId=${a.id}`}
            className={[
              'rounded-t px-4 py-2 text-sm',
              active
                ? 'border-x border-t border-border bg-surface text-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            ].join(' ')}
          >
            {a.name}
          </Link>
        );
      })}
      <Link
        href="/kukaku/areas"
        className="ml-auto rounded px-3 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        エリア管理
      </Link>
    </div>
  );
}
