import { defaultValueFormatter, lineRange } from './chart-utils';

export interface LineSeries {
  name: string;
  colorVar: string;
  points: number[];
}

export interface LineChartProps {
  series: LineSeries[];
  xLabels: string[];
  /** role=img の説明文 (系列・データ点を要約)。 */
  ariaLabel: string;
  valueFormatter?: (n: number) => string;
  /** SVG の viewBox 高さ (px 相当)。 */
  height?: number;
  /** sr-only テーブルの caption。 */
  caption?: string;
}

const VIEW_W = 800;
const PAD_TOP = 28;
const PAD_BOTTOM = 36;
const PAD_X = 24;

/**
 * 折れ線グラフ (差引・件数の推移)。自作 SVG。負値対応:
 * min/max からスケールし 0 基線が中央寄りに来るので line が下にも伸びる。
 * 全点同値 (全 0 等) で max-min===0 のときは lineRange がダミーレンジを返し
 * 0 除算を避けて全点を中央線上に描く。server component として利用可。
 */
export function LineChart({
  series,
  xLabels,
  ariaLabel,
  valueFormatter = defaultValueFormatter,
  height = 260,
  caption,
}: LineChartProps) {
  const allPoints = series.flatMap((s) => s.points);
  const { min, max } = lineRange(allPoints);
  const span = max - min; // lineRange により常に > 0
  const plotH = height - PAD_TOP - PAD_BOTTOM;
  const plotW = VIEW_W - PAD_X * 2;
  const n = xLabels.length;
  const stepX = n > 1 ? plotW / (n - 1) : 0;
  // 10 年表示 (UI 上限) までは全年度ラベルを残し、13 年度以上で間引く。
  const labelStep = n > 12 ? Math.ceil(n / 9) : 1;

  const yFor = (v: number) => PAD_TOP + (1 - (v - min) / span) * plotH;
  const xFor = (i: number) => (n > 1 ? PAD_X + stepX * i : VIEW_W / 2);

  // 0 がレンジ内にあれば 0 基線を描く。
  const zeroInRange = min <= 0 && max >= 0;
  const zeroY = yFor(0);

  return (
    <figure className="w-full">
      <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
        {series.map((s) => (
          <li key={s.name} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-3 w-3 rounded-sm"
              style={{ backgroundColor: s.colorVar }}
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
        {/* 装飾的なグラフィック。数値は併設 sr-only テーブルに集約し AT には重複読み上げさせない。 */}
        <g aria-hidden="true">
        {zeroInRange && (
          <line
            x1={PAD_X}
            y1={zeroY}
            x2={VIEW_W - PAD_X}
            y2={zeroY}
            stroke="var(--border)"
            strokeWidth={1}
          />
        )}

        {/* x 軸ラベル */}
        {xLabels.map((label, i) =>
          i % labelStep === 0 ? (
            <text
              key={`xl-${label}`}
              x={xFor(i)}
              y={height - 12}
              textAnchor="middle"
              fontSize={13}
              fill="currentColor"
              className="text-muted-foreground"
            >
              {label}
            </text>
          ) : null,
        )}

        {series.map((s) => {
          const pts = s.points.map((v, i) => `${xFor(i)},${yFor(v)}`).join(' ');
          return (
            <g key={s.name}>
              {s.points.length > 1 && (
                <polyline
                  points={pts}
                  fill="none"
                  stroke={s.colorVar}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )}
              {s.points.map((v, i) => (
                <g key={`${s.name}-${i}`}>
                  <circle cx={xFor(i)} cy={yFor(v)} r={3.5} fill={s.colorVar} />
                  {n <= 9 && (
                    <text
                      x={xFor(i)}
                      y={yFor(v) - 8}
                      textAnchor="middle"
                      fontSize={12}
                      fill="currentColor"
                      className="text-foreground"
                    >
                      {valueFormatter(v)}
                    </text>
                  )}
                </g>
              ))}
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
            {series.map((s) => (
              <th key={s.name} scope="col">
                {s.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {xLabels.map((label, i) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              {series.map((s) => (
                <td key={s.name}>{valueFormatter(s.points[i] ?? 0)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
