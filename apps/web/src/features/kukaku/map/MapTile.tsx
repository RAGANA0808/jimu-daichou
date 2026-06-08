'use client';

import { useDraggable } from '@dnd-kit/core';
import type { CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import type { MapPlotTile, DragData } from './types';
import { TILE_SIZE } from './grid';
import {
  GRAVE_PLOT_STATUS_LABELS,
  GRAVE_PLOT_STATUS_TILE_CLASSES,
  GRAVE_PLOT_TYPE_SHORT,
} from '../types';

type Props = {
  plot: MapPlotTile;
  source: 'canvas' | 'palette';
};

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

  const subLabel = plot.monumentName ?? plot.householderName ?? '';
  const title = [
    `区画 ${plot.plotNumber}`,
    `状態: ${GRAVE_PLOT_STATUS_LABELS[plot.status]}`,
    plot.monumentName ? `墓標: ${plot.monumentName}` : null,
    plot.householderName ? `契約: ${plot.householderName}` : null,
  ]
    .filter(Boolean)
    .join(' / ');

  return (
    <div
      ref={setNodeRef}
      style={{ ...baseStyle, ...positionStyle, ...transformStyle }}
      className={[
        'flex flex-col items-center justify-center gap-0.5 rounded border px-0.5 text-center',
        'select-none overflow-hidden',
        GRAVE_PLOT_STATUS_TILE_CLASSES[plot.status],
        isDragging
          ? 'opacity-50 shadow-lg z-10'
          : 'hover:ring-2 hover:ring-muted-foreground',
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
      <span className="text-xs font-medium leading-none">
        {GRAVE_PLOT_TYPE_SHORT[plot.plotType]}
        {plot.plotNumber}
      </span>
      {subLabel.length > 0 && (
        <span className="w-full truncate text-[10px] leading-none opacity-80">
          {subLabel}
        </span>
      )}
    </div>
  );
}
