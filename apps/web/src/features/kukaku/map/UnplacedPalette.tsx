'use client';

import { useDroppable } from '@dnd-kit/core';
import { MapTile } from './MapTile';
import { MAP_PALETTE_DROPPABLE_ID, type MapPlotTile } from './types';

type Props = {
  plots: MapPlotTile[];
};

export function UnplacedPalette({ plots }: Props) {
  const { setNodeRef, isOver } = useDroppable({
    id: MAP_PALETTE_DROPPABLE_ID,
  });

  return (
    <div
      ref={setNodeRef}
      className={[
        'rounded border bg-white p-3',
        isOver ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-300',
      ].join(' ')}
    >
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-700">未配置</h2>
        <span className="text-xs text-gray-500">{plots.length} 件</span>
      </div>
      {plots.length === 0 ? (
        <p className="py-4 text-center text-xs text-gray-500">
          このエリアに未配置の区画はありません。
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {plots.map((p) => (
            <MapTile key={p.id} plot={p} source="palette" />
          ))}
        </div>
      )}
      <p className="mt-3 text-xs text-gray-500">
        ここに区画をドラッグすると未配置に戻せます。
      </p>
    </div>
  );
}
