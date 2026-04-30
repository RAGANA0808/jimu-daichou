'use client';

import { useDroppable } from '@dnd-kit/core';
import { forwardRef } from 'react';
import { MapTile } from './MapTile';
import { MAP_CANVAS_DROPPABLE_ID, type MapPlotTile } from './types';
import { GRID_SNAP } from './grid';

type Props = {
  width: number;
  height: number;
  plots: MapPlotTile[];
};

export const MapCanvas = forwardRef<HTMLDivElement, Props>(function MapCanvas(
  { width, height, plots },
  ref,
) {
  const { setNodeRef, isOver } = useDroppable({ id: MAP_CANVAS_DROPPABLE_ID });

  // forwardRef と dnd-kit の ref の両立
  const handleRef = (node: HTMLDivElement | null) => {
    setNodeRef(node);
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  };

  return (
    <div
      ref={handleRef}
      className={[
        'relative overflow-auto rounded border bg-white',
        isOver ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-300',
      ].join(' ')}
      style={{
        width,
        height,
        backgroundImage: `
          linear-gradient(to right, #e5e7eb 1px, transparent 1px),
          linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
        `,
        backgroundSize: `${GRID_SNAP}px ${GRID_SNAP}px`,
      }}
    >
      {plots.map((p) => (
        <MapTile key={p.id} plot={p} source="canvas" />
      ))}
    </div>
  );
});
