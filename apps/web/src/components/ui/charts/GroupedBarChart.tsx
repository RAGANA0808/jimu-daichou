import { barScaleMax, defaultValueFormatter } from './chart-utils';

export interface GroupedBarSeriesValue {
  name: string;
  value: number;
  colorVar: string;
}

export interface GroupedBarGroup {
  label: string;
  values: GroupedBarSeriesValue[];
}

export interface GroupedBarChartProps {
  groups: GroupedBarGroup[];
  /** role=img の説明文 (系列・データ点を要約)。 */
  ariaLabel: string;
  valueFormatter?: (n: number) => string;
  /** SVG の viewBox 高さ (px 相当)。 */
  height?: number;
  /** sr-only テーブルの caption。 */
  caption?: string;
  /**
   * sr-only テーブルにだけ載せる追加列 (例: 差引)。視覚棒には描かないが
   * スクリーンリーダ利用者向けに数値を提供する。
   */
  extraColumns?: { header: string; values: number[] }[];
}

const VIEW_W = 800;
const PAD_TOP = 28;
const PAD_BOTTOM = 36;
const PAD_X = 16;

// 色覚多様性に配慮し、系列を色だけでなく地紋 (テクスチャ) でも弁別する
// (CLAUDE.md E13: 色だけに頼らない)。系列 0 は無地、1 以降に斜線/ドットを重ねる。
const HATCH_ID = 'gbc-tex-hatch';
const DOTS_ID = 'gbc-tex-dots';

/** 系列インデックス (>0) に対応する SVG 地紋の url。系列 0 (無地) は null。 */
function seriesPatternUrl(si: number): string | null {
  if (si <= 0) return null;
  return (si - 1) % 2 === 0 ? `url(#${HATCH_ID})` : `url(#${DOTS_ID})`;
}

/** 凡例スウォッチに地紋を重ねる CSS 背景 (SVG の地紋と見た目を一致させる)。 */
function legendSwatchStyle(colorVar: string, si: number): React.CSSProperties {
  if (si <= 0) return { backgroundColor: colorVar };
  if ((si - 1) % 2 === 0) {
    return {
      backgroundColor: colorVar,
      backgroundImage:
        'repeating-linear-gradient(45deg, rgba(255,255,255,0.65) 0 1.5px, transparent 1.5px 4px)',
    };
  }
  return {
    backgroundColor: colorVar,
    backgroundImage:
      'radial-gradient(rgba(255,255,255,0.85) 1px, transparent 1.3px)',
    backgroundSize: '4px 4px',
  };
}

/**
 * 1 カテゴリ複数系列の集合棒グラフ (収入/支出の並置など)。自作 SVG。
 * 純粋な props -> SVG 描画で server component として利用可。
 * 負値は 0 にクランプして棒を出さず、実数は併設テーブルに表示する。
 *
 * 前提: 全グループは同一系列・同一順序 (values の長さと name 並びが揃っている) であること。
 * 凡例・棒幅・併設テーブルの列は groups[0] の系列定義を基準に描画する。
 */
export function GroupedBarChart({
  groups,
  ariaLabel,
  valueFormatter = defaultValueFormatter,
  height = 280,
  caption,
  extraColumns = [],
}: GroupedBarChartProps) {
  const allValues = groups.flatMap((g) => g.values.map((v) => v.value));
  const max = barScaleMax(allValues);
  const plotH = height - PAD_TOP - PAD_BOTTOM;
  const plotW = VIEW_W - PAD_X * 2;
  const slot = groups.length > 0 ? plotW / groups.length : plotW;
  const seriesCount = groups[0]?.values.length ?? 1;
  const groupInner = Math.min(slot * 0.7, 96);
  const barW = seriesCount > 0 ? groupInner / seriesCount : groupInner;
  const baseline = height - PAD_BOTTOM;
  // 10 年表示 (UI 上限) までは全年度ラベルを残し、13 年度以上で間引く。
  const labelStep = groups.length > 12 ? Math.ceil(groups.length / 9) : 1;

  // 凡例は最初のグループの系列定義から作る (全グループ同一系列の前提)。
  const legend = groups[0]?.values ?? [];

  return (
    <figure className="w-full">
      <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
        {legend.map((s, si) => (
          <li key={s.name} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-3 w-3 rounded-sm border border-border"
              style={legendSwatchStyle(s.colorVar, si)}
            />
            {s.name}
          </li>
        ))}
      </ul>

      <svg
        role="img"
        aria-label={ariaLabel}
        viewBox={`0 0 ${VIEW_W} ${height}`}
        width="100%"
        className="h-auto w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <pattern
            id={HATCH_ID}
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="6"
              stroke="rgba(255,255,255,0.65)"
              strokeWidth={2}
            />
          </pattern>
          <pattern id={DOTS_ID} width="6" height="6" patternUnits="userSpaceOnUse">
            <circle cx="3" cy="3" r="1.2" fill="rgba(255,255,255,0.8)" />
          </pattern>
        </defs>
        {/* 装飾的なグラフィック。数値は併設 sr-only テーブルに集約し AT には重複読み上げさせない。 */}
        <g aria-hidden="true">
        <line
          x1={PAD_X}
          y1={baseline}
          x2={VIEW_W - PAD_X}
          y2={baseline}
          stroke="var(--border)"
          strokeWidth={1}
        />
        {groups.map((g, gi) => {
          const groupCx = PAD_X + slot * gi + slot / 2;
          const groupStart = groupCx - groupInner / 2;
          const showLabel = gi % labelStep === 0;
          return (
            <g key={g.label}>
              {g.values.map((s, si) => {
                const clamped = s.value > 0 ? s.value : 0;
                const h = (clamped / max) * plotH;
                const x = groupStart + barW * si + barW * 0.1;
                const w = barW * 0.8;
                const y = baseline - h;
                const tex = seriesPatternUrl(si);
                return (
                  <g key={s.name}>
                    <rect
                      x={x}
                      y={y}
                      width={w}
                      height={h}
                      rx={2}
                      fill={s.colorVar}
                    />
                    {tex && (
                      <rect
                        x={x}
                        y={y}
                        width={w}
                        height={h}
                        rx={2}
                        fill={tex}
                      />
                    )}
                    {/* 長期間は系列数 x 年度数でラベルが過密になるため
                        9 年度超のときは数値ラベルを描かない (テーブルで補完)。 */}
                    {groups.length <= 9 && (
                      <text
                        x={x + w / 2}
                        y={y - 5}
                        textAnchor="middle"
                        fontSize={11}
                        fill="currentColor"
                        className="text-muted-foreground"
                      >
                        {valueFormatter(s.value)}
                      </text>
                    )}
                  </g>
                );
              })}
              {showLabel && (
                <text
                  x={groupCx}
                  y={height - 12}
                  textAnchor="middle"
                  fontSize={13}
                  fill="currentColor"
                  className="text-muted-foreground"
                >
                  {g.label}
                </text>
              )}
            </g>
          );
        })}
        </g>
      </svg>

      <table className="sr-only">
        {caption && <caption>{caption}</caption>}
        <thead>
          <tr>
            <th scope="col">年度</th>
            {legend.map((s) => (
              <th key={s.name} scope="col">
                {s.name}
              </th>
            ))}
            {extraColumns.map((c) => (
              <th key={c.header} scope="col">
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((g, gi) => (
            <tr key={g.label}>
              <th scope="row">{g.label}</th>
              {g.values.map((s) => (
                <td key={s.name}>{valueFormatter(s.value)}</td>
              ))}
              {extraColumns.map((c) => (
                <td key={c.header}>{valueFormatter(c.values[gi] ?? 0)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
