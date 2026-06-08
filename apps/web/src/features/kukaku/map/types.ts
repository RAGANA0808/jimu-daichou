import type { GravePlotStatus, GravePlotType } from '@prisma/client';

export type MapTileStatus = GravePlotStatus;

export type MapPlotTile = {
  id: string;
  plotNumber: string;
  plotType: GravePlotType;
  status: MapTileStatus;
  areaId: string | null;
  positionX: number | null;
  positionY: number | null;
  householderName: string | null;
  monumentName: string | null;
};

export type DragData = {
  plotId: string;
  source: 'canvas' | 'palette';
  initialX: number | null;
  initialY: number | null;
};

export const MAP_CANVAS_DROPPABLE_ID = 'map-canvas';
export const MAP_PALETTE_DROPPABLE_ID = 'map-palette';
