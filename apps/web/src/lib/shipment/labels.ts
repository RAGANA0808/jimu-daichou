/**
 * 宛名ラベル (タックシール) の A4 面付けレイアウト計算 (純関数)。
 *
 * 市販タックシールの代表的な規格を mm 単位で定義し、宛先配列をページ単位の
 * グリッドに割り付ける。PDF 側 (features/shipment/pdf) はここで得た座標をそのまま
 * 描画するだけにし、レイアウト計算ロジックはこのモジュールに集約する。
 */

/** A4 用紙サイズ (mm)。 */
export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;

export type LabelSheetSpec = {
  /** 規格 ID (URL パラメータ等で使う識別子)。 */
  id: string;
  /** 表示名。 */
  label: string;
  columns: number;
  rows: number;
  /** ラベル 1 枚の幅 (mm)。 */
  labelWidthMm: number;
  /** ラベル 1 枚の高さ (mm)。 */
  labelHeightMm: number;
  /** 用紙左端から最初のラベル左端までの余白 (mm)。 */
  marginLeftMm: number;
  /** 用紙上端から最初のラベル上端までの余白 (mm)。 */
  marginTopMm: number;
  /** 隣り合うラベルの水平間隔 (mm)。 */
  columnGapMm: number;
  /** 隣り合うラベルの垂直間隔 (mm)。 */
  rowGapMm: number;
};

/**
 * 代表的なタックシール規格。
 * - a4-21: 3 列 × 7 段 = 21 面 (A-ONE 72321 等の定番)
 * - a4-12: 2 列 × 6 段 = 12 面 (大きめ、住所が長い世帯向け)
 * - a4-44: 4 列 × 11 段 = 44 面 (小ラベル)
 */
export const LABEL_SHEET_SPECS: readonly LabelSheetSpec[] = [
  {
    id: 'a4-21',
    label: 'A4 21面 (3×7)',
    columns: 3,
    rows: 7,
    labelWidthMm: 70,
    labelHeightMm: 42.3,
    marginLeftMm: 0,
    marginTopMm: 0,
    columnGapMm: 0,
    rowGapMm: 0,
  },
  {
    id: 'a4-12',
    label: 'A4 12面 (2×6)',
    columns: 2,
    rows: 6,
    labelWidthMm: 86.4,
    labelHeightMm: 42.3,
    marginLeftMm: 18.6,
    marginTopMm: 21.2,
    columnGapMm: 0,
    rowGapMm: 0,
  },
  {
    id: 'a4-44',
    label: 'A4 44面 (4×11)',
    columns: 4,
    rows: 11,
    labelWidthMm: 48.3,
    labelHeightMm: 25.4,
    marginLeftMm: 8.4,
    marginTopMm: 13.5,
    columnGapMm: 0,
    rowGapMm: 0,
  },
];

export const DEFAULT_LABEL_SHEET_ID = 'a4-21';

export function findLabelSheetSpec(id: string | null | undefined): LabelSheetSpec {
  const found = LABEL_SHEET_SPECS.find((s) => s.id === id);
  return found ?? LABEL_SHEET_SPECS[0]!;
}

/** 1 枚に乗るラベル数。 */
export function labelsPerSheet(spec: LabelSheetSpec): number {
  return spec.columns * spec.rows;
}

export type PlacedLabel<T> = {
  item: T;
  /** 用紙左端からの左位置 (mm)。 */
  xMm: number;
  /** 用紙上端からの上位置 (mm)。 */
  yMm: number;
  widthMm: number;
  heightMm: number;
};

/** 1 ページ分の配置済みラベル。 */
export type LabelPage<T> = {
  pageIndex: number;
  labels: Array<PlacedLabel<T>>;
};

/**
 * 宛先配列を、指定規格のラベルシートのページ群へ割り付ける。
 * 左上から右へ、行を埋めたら次の段へ進む (一般的な印刷順)。
 */
export function layoutLabels<T>(
  items: readonly T[],
  spec: LabelSheetSpec,
): Array<LabelPage<T>> {
  const perSheet = labelsPerSheet(spec);
  if (perSheet <= 0) return [];

  const pages: Array<LabelPage<T>> = [];
  for (let i = 0; i < items.length; i += perSheet) {
    const slice = items.slice(i, i + perSheet);
    const labels: Array<PlacedLabel<T>> = slice.map((item, idx) => {
      const col = idx % spec.columns;
      const row = Math.floor(idx / spec.columns);
      const xMm =
        spec.marginLeftMm + col * (spec.labelWidthMm + spec.columnGapMm);
      const yMm =
        spec.marginTopMm + row * (spec.labelHeightMm + spec.rowGapMm);
      return {
        item,
        xMm,
        yMm,
        widthMm: spec.labelWidthMm,
        heightMm: spec.labelHeightMm,
      };
    });
    pages.push({ pageIndex: pages.length, labels });
  }
  return pages;
}

/** mm → pt 変換 (PDF は pt 基準。1 inch = 25.4mm = 72pt)。 */
export function mmToPt(mm: number): number {
  return (mm / 25.4) * 72;
}
