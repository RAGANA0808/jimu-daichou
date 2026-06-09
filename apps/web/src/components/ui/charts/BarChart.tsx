import { barScaleMax, defaultValueFormatter } from './chart-utils';

export interface BarChartDatum {
  label: string;
  value: number;
}

export interface BarChartProps {
  data: BarChartDatum[];
  /** role=img の説明文 (系列・データ点を要約)。 */
  ariaLabel: string;
  /** 棒の色トークン。既定はブランド橙。 */
  colorVar?: string;
  valueFormatter?: (n: number) => string;
  /** SVG の viewBox 高さ (px 相当)。 */
  height?: number;
  /** sr-only テーブルの caption。 */
  caption?: string;
  /** sr-only テーブルの値列見出し。 */
  valueHeader?: string;
}

const VIEW_W = 800;
const PAD_TOP = 28;
const PAD_BOTTOM = 36;
const PAD_X = 16;

/**
 * 単系列の縦棒グラフ (自作 SVG)。会計年度別の件数・金額推移を表す。
 * 純粋な props -> SVG 描画で server component として利用可 (use client 不要)。
 * 負値は 0 にクランプして棒を出さず、実数は併設テーブルに表示する。
 */
export function BarChart({
  data,
  ariaLabel,
  colorVar = 'var(--brand)',
  valueFormatter = defaultValueFormatter,
  height = 260,
  caption,
  valueHeader = '値',
}: BarChartProps) {
  const max = barScaleMax(data.map((d) => d.value));
  const plotH = height - PAD_TOP - PAD_BOTTOM;
  const plotW = VIEW_W - PAD_X * 2;
  const slot = data.length > 0 ? plotW / data.length : plotW;
  const barW = Math.min(slot * 0.6, 64);
  const baseline = height - PAD_BOTTOM;
  // 年度数が多いときラベルが重ならないよう間引く。
  // 10 年表示 (UI 上限) までは全年度ラベルを残し、13 年度以上で間引く。
  const labelStep = data.length > 12 ? Math.ceil(data.length / 9) : 1;

  return (
    <figure className="w-full">
      <svg
        role="img"
        aria-label={ariaLabel}
        viewBox={`0 0 ${VIEW_W} ${height}`}
        width="100%"
        className="h-auto w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* 0 基線 */}
        <line
          x1={PAD_X}
          y1={baseline}
          x2={VIEW_W - PAD_X}
          y2={baseline}
          stroke="var(--border)"
          strokeWidth={1}
        />
        {data.map((d, i) => {
          const clamped = d.value > 0 ? d.value : 0;
          const h = (clamped / max) * plotH;
          const cx = PAD_X + slot * i + slot / 2;
          const x = cx - barW / 2;
          const y = baseline - h;
          const showLabel = i % labelStep === 0;
          return (
            <g key={d.label}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={h}
                rx={2}
                fill={colorVar}
              />
              <text
                x={cx}
                y={y - 6}
                textAnchor="middle"
                fontSize={13}
                fill="currentColor"
                className="text-foreground"
              >
                {valueFormatter(d.value)}
              </text>
              {showLabel && (
                <text
                  x={cx}
                  y={height - 12}
                  textAnchor="middle"
                  fontSize={13}
                  fill="currentColor"
                  className="text-muted-foreground"
                >
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <table className="sr-only">
        {caption && <caption>{caption}</caption>}
        <thead>
          <tr>
            <th scope="col">年度</th>
            <th scope="col">{valueHeader}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <th scope="row">{d.label}</th>
              <td>{valueFormatter(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
