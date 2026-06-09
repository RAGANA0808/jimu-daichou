'use client';

import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useOptimistic, useRef, useState, useTransition } from 'react';
import { normalizePosition } from './grid';
import { MapCanvas } from './MapCanvas';
import { UnplacedPalette } from './UnplacedPalette';
import { AreaTabs } from './AreaTabs';
import {
  MAP_CANVAS_DROPPABLE_ID,
  MAP_PALETTE_DROPPABLE_ID,
  type DragData,
  type MapPlotTile,
} from './types';
import {
  updateGravePlotPlacementAction,
  unplaceGravePlotAction,
} from './placementActions';

type AreaTab = { id: string; name: string };

type Props = {
  areas: AreaTab[];
  currentArea: {
    id: string;
    name: string;
    canvasWidth: number;
    canvasHeight: number;
  };
  placed: MapPlotTile[];
  palette: MapPlotTile[];
};

type OptimisticState = {
  placed: MapPlotTile[];
  palette: MapPlotTile[];
};

type Mutation =
  | { type: 'place'; plotId: string; x: number; y: number }
  | { type: 'unplace'; plotId: string };

function applyMutation(
  state: OptimisticState,
  m: Mutation,
): OptimisticState {
  if (m.type === 'place') {
    // plotId を palette / placed の両方から除去 → 新しい位置で placed に追加
    const fromPalette = state.palette.find((p) => p.id === m.plotId);
    const fromPlaced = state.placed.find((p) => p.id === m.plotId);
    const src = fromPlaced ?? fromPalette;
    if (!src) return state;
    const updated: MapPlotTile = {
      ...src,
      positionX: m.x,
      positionY: m.y,
    };
    return {
      placed: [
        ...state.placed.filter((p) => p.id !== m.plotId),
        updated,
      ],
      palette: state.palette.filter((p) => p.id !== m.plotId),
    };
  }
  if (m.type === 'unplace') {
    const fromPlaced = state.placed.find((p) => p.id === m.plotId);
    if (!fromPlaced) return state;
    const updated: MapPlotTile = {
      ...fromPlaced,
      positionX: null,
      positionY: null,
    };
    return {
      placed: state.placed.filter((p) => p.id !== m.plotId),
      palette: [...state.palette, updated],
    };
  }
  return state;
}

export function MapBoard({ areas, currentArea, placed, palette }: Props) {
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);

  const [optimistic, mutate] = useOptimistic<OptimisticState, Mutation>(
    { placed, palette },
    applyMutation,
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over, delta } = event;
    if (!over) return;

    const data = active.data.current as DragData | undefined;
    if (!data) return;

    if (over.id === MAP_CANVAS_DROPPABLE_ID) {
      let rawX: number;
      let rawY: number;

      if (
        data.source === 'canvas' &&
        data.initialX !== null &&
        data.initialY !== null
      ) {
        rawX = data.initialX + delta.x;
        rawY = data.initialY + delta.y;
      } else {
        // palette → canvas: drop 位置を canvas 相対で計算
        const canvasRect = canvasRef.current?.getBoundingClientRect();
        const activeRect = active.rect.current.translated;
        if (!canvasRect || !activeRect) return;
        rawX = activeRect.left - canvasRect.left;
        rawY = activeRect.top - canvasRect.top;
      }

      const { x, y } = normalizePosition(
        rawX,
        rawY,
        currentArea.canvasWidth,
        currentArea.canvasHeight,
      );

      startTransition(() => {
        mutate({ type: 'place', plotId: data.plotId, x, y });
        void (async () => {
          const result = await updateGravePlotPlacementAction({
            gravePlotId: data.plotId,
            areaId: currentArea.id,
            positionX: x,
            positionY: y,
          });
          if (result.status === 'error') {
            setErrorMsg(result.message);
          } else {
            setErrorMsg(null);
          }
        })();
      });
      return;
    }

    if (over.id === MAP_PALETTE_DROPPABLE_ID) {
      if (data.source !== 'canvas') return; // palette → palette は無意味

      startTransition(() => {
        mutate({ type: 'unplace', plotId: data.plotId });
        void (async () => {
          const result = await unplaceGravePlotAction({
            gravePlotId: data.plotId,
          });
          if (result.status === 'error') {
            setErrorMsg(result.message);
          } else {
            setErrorMsg(null);
          }
        })();
      });
      return;
    }
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="space-y-4">
        <AreaTabs areas={areas} currentAreaId={currentArea.id} />

        {errorMsg && (
          <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
            保存に失敗しました: {errorMsg}
          </div>
        )}

        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="flex-1 overflow-auto">
            <MapCanvas
              ref={canvasRef}
              width={currentArea.canvasWidth}
              height={currentArea.canvasHeight}
              plots={optimistic.placed}
            />
          </div>
          <div className="lg:w-[280px]">
            <UnplacedPalette plots={optimistic.palette} />
          </div>
        </div>

        {isPending && (
          <p className="text-xs text-muted-foreground">保存中...</p>
        )}
      </div>
    </DndContext>
  );
}
