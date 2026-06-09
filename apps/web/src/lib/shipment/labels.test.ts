import { describe, expect, it } from 'vitest';
import {
  findLabelSheetSpec,
  labelsPerSheet,
  layoutLabels,
  mmToPt,
  LABEL_SHEET_SPECS,
} from './labels';

describe('findLabelSheetSpec', () => {
  it('既知の ID を解決する', () => {
    expect(findLabelSheetSpec('a4-12').id).toBe('a4-12');
  });
  it('未知/空の ID は先頭 (既定 21面) にフォールバックする', () => {
    expect(findLabelSheetSpec(null).id).toBe('a4-21');
    expect(findLabelSheetSpec('nope').id).toBe('a4-21');
  });
});

describe('labelsPerSheet', () => {
  it('列 × 段 を返す', () => {
    expect(labelsPerSheet(LABEL_SHEET_SPECS[0]!)).toBe(21);
  });
});

describe('layoutLabels', () => {
  const spec = findLabelSheetSpec('a4-21'); // 3×7, 70×42.3mm, 余白 0

  it('21 件は 1 ページに収まる', () => {
    const pages = layoutLabels(Array.from({ length: 21 }, (_, i) => i), spec);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.labels).toHaveLength(21);
  });

  it('22 件は 2 ページに分かれ、2 ページ目は 1 件', () => {
    const pages = layoutLabels(Array.from({ length: 22 }, (_, i) => i), spec);
    expect(pages).toHaveLength(2);
    expect(pages[1]!.labels).toHaveLength(1);
  });

  it('0 件は 0 ページ', () => {
    expect(layoutLabels([], spec)).toHaveLength(0);
  });

  it('左上→右へ、行を埋めて次段へ進む座標を割り付ける', () => {
    const pages = layoutLabels([0, 1, 2, 3], spec);
    const labels = pages[0]!.labels;
    // 0,1,2 は同じ段 (y=0)、x は 0,70,140
    expect(labels[0]).toMatchObject({ xMm: 0, yMm: 0 });
    expect(labels[1]).toMatchObject({ xMm: 70, yMm: 0 });
    expect(labels[2]).toMatchObject({ xMm: 140, yMm: 0 });
    // 4 件目は次段 (row 1) の左端
    expect(labels[3]!.xMm).toBe(0);
    expect(labels[3]!.yMm).toBeCloseTo(42.3, 5);
  });

  it('余白つき規格 (a4-12) は marginLeft/Top を起点にする', () => {
    const s = findLabelSheetSpec('a4-12'); // marginLeft 18.6, marginTop 21.2
    const pages = layoutLabels([0], s);
    expect(pages[0]!.labels[0]).toMatchObject({ xMm: 18.6, yMm: 21.2 });
  });
});

describe('mmToPt', () => {
  it('25.4mm = 72pt', () => {
    expect(mmToPt(25.4)).toBeCloseTo(72, 5);
  });
});
