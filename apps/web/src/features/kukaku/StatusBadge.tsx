import type { GravePlotStatus } from '@prisma/client';
import {
  GRAVE_PLOT_STATUS_DOT_CLASSES,
  GRAVE_PLOT_STATUS_LABELS,
} from './types';

/**
 * 区画ステータスのバッジ (ドット + ラベル)。
 *
 * 既存 Badge の variant は 5 種前提で 7 状態 (滞納/無縁化/合祀済 を含む) を表現しきれないため、
 * 機能色マップ (GRAVE_PLOT_STATUS_DOT_CLASSES) ベースの専用コンポーネントに統一する。
 * 一覧・カルテ・区画詳細・地図凡例で同一表現を使い回す。
 * 色のみに依存しないよう、ドットとラベルを必ずセットで描く (特許回避の配色制約)。
 */
export function GravePlotStatusBadge({
  status,
  className,
}: {
  status: GravePlotStatus;
  className?: string;
}) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-0.5 text-xs font-medium text-foreground',
        className ?? '',
      ].join(' ')}
    >
      <span
        className={`inline-block h-2.5 w-2.5 rounded-full ${GRAVE_PLOT_STATUS_DOT_CLASSES[status]}`}
        aria-hidden="true"
      />
      {GRAVE_PLOT_STATUS_LABELS[status]}
    </span>
  );
}
