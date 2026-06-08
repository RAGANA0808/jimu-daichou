import {
  GRAVE_PLOT_STATUS_DOT_CLASSES,
  GRAVE_PLOT_STATUS_LABELS,
  GRAVE_PLOT_STATUS_ORDER,
} from '../types';

/**
 * 地図の状態色 凡例。色とラベルを必ずセットで描き「色のみ依存」を回避する (特許回避の配色制約)。
 */
export function StatusLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {GRAVE_PLOT_STATUS_ORDER.map((s) => (
        <li key={s} className="flex items-center gap-1.5">
          <span
            className={`inline-block h-3 w-3 rounded-sm ${GRAVE_PLOT_STATUS_DOT_CLASSES[s]}`}
            aria-hidden="true"
          />
          <span>{GRAVE_PLOT_STATUS_LABELS[s]}</span>
        </li>
      ))}
    </ul>
  );
}
