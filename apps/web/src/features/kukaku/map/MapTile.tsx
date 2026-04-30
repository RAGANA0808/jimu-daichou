'use client';

import { useDraggable } from '@dnd-kit/core';
import type { CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import type { MapPlotTile, DragData } from './types';
import { TILE_SIZE } from './grid';

type Props = {
  plot: MapPlotTile;
  source: 'canvas' | 'palette';
};

function statusClasses(status: MapPlotTile['status']): string {
  switch (status) {
    case 'AVAILABLE':
      return 'bg-gray-100 border-gray-400 text-gray-700';
    case 'RESERVED':
      return 'bg-amber-100 border-amber-600 text-amber-900';
    case 'IN_USE':
      return 'bg-blue-100 border-blue-600 text-blue-900';
    case 'CLOSED':
      return 'bg-gray-50 border-gray-400 border-dashed text-gray-500';
  }
}

export function MapTile({ plot, source }: Props) {
  const router = useRouter();

  const dragData: DragData = {
    plotId: plot.id,
    source,
    initialX: plot.positionX,
    initialY: plot.positionY,
  };

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: `plot:${plot.id}:${source}`, data: dragData });

  const baseStyle: CSSProperties = {
    width: TILE_SIZE,
    height: TILE_SIZE,
    touchAction: 'none', // pointer drag 中のスクロール防止
  };

  const positionStyle: CSSProperties =
    source === 'canvas' && plot.positionX !== null && plot.positionY !== null
      ? {
          position: 'absolute',
          left: plot.positionX,
          top: plot.positionY,
        }
      : {};

  const transformStyle: CSSProperties = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : {};

  const title = [
    `区画 ${plot.plotNumber}`,
    plot.householderName ? `契約: ${plot.householderName}` : null,
  ]
    .filter(Boolean)
    .join(' / ');

  return (
    <div
      ref={setNodeRef}
      style={{ ...baseStyle, ...positionStyle, ...transformStyle }}
      className={[
        'flex items-center justify-center rounded border text-xs font-medium',
        'select-none',
        statusClasses(plot.status),
        isDragging ? 'opacity-50 shadow-lg z-10' : 'hover:ring-2 hover:ring-gray-400',
      ].join(' ')}
      title={title}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        if (isDragging) {
          e.preventDefault();
          return;
        }
        // ドラッグしきい値 (4px) を越えない場合のみクリックとして発火する
        router.push(`/kukaku/${plot.id}`);
      }}
      role="button"
      tabIndex={0}
    >
      {plot.plotNumber}
    </div>
  );
}
