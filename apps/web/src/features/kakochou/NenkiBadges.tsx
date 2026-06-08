import { allAnniversariesOf, type Anniversary } from '@/lib/nenki';
import { findEraByCode, formatWareki, seirekiToWareki } from '@/lib/wareki';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type NenkiBadgesProps = {
  /** 没年（西暦）。null（datePrecision=UNKNOWN）のときは何も描画しない。 */
  deathYear: number | null;
  /** 没月（1-12）。null 可。和暦変換・命日表示のフォールバックに使う。 */
  deathMonth: number | null;
  /** 没日（1-31）。null 可。 */
  deathDay: number | null;
  /** 弔い上げ回忌（memorialCutoffAnniversary をそのまま）。null=五十回忌まで。 */
  cutoff?: number | null;
  /** テスト用に「現在年」を注入できる（既定: JST の実行時年）。 */
  currentYear?: number;
  /** レイアウト方針。'wrap'=折返し（カード/展開行向け）, 'scroll'=横スクロール（行内向け）。既定 'wrap'。 */
  layout?: 'wrap' | 'scroll';
};

/** JST 固定で現在の西暦年を取得する（サーバ TZ に依存しない）。 */
function currentYearInJst(): number {
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
  }).format(new Date());
  return Number(formatted);
}

/**
 * 回忌 1 件分の日付ラベルを「和暦（西暦）」形式で整形する。
 * - 月日あり: 令和8年3月15日（2026/3/15）
 * - 月のみ:   令和8年（2026年3月）
 * - 年のみ:   令和8年（2026年）
 * - 和暦変換失敗: 2026年（西暦のみ）
 *
 * 和暦は @/lib/wareki の共通関数のみで整形する（インライン暦計算はしない）。
 */
function formatAnniversaryLabel(ann: Anniversary): string {
  const { year, month, day } = ann;

  if (month !== null && day !== null) {
    try {
      const wareki = seirekiToWareki({ year, month, day });
      return formatWareki(wareki, { withSeireki: true });
    } catch {
      return `${year}年${month}月${day}日`;
    }
  }

  // 月日が揃わない場合は、和暦「年」だけを得るためにダミー月日(1/1)で変換する。
  let warekiYearLabel: string | null = null;
  try {
    const wareki = seirekiToWareki({ year, month: 1, day: 1 });
    const era = findEraByCode(wareki.era);
    const yearLabel = wareki.year === 1 ? '元' : String(wareki.year);
    warekiYearLabel = `${era.nameJa}${yearLabel}年`;
  } catch {
    warekiYearLabel = null;
  }

  const seirekiLabel = month !== null ? `${year}年${month}月` : `${year}年`;

  if (warekiYearLabel === null) {
    return seirekiLabel;
  }
  return `${warekiYearLabel}（${seirekiLabel}）`;
}

export function NenkiBadges({
  deathYear,
  deathMonth,
  deathDay,
  cutoff,
  currentYear,
  layout = 'wrap',
}: NenkiBadgesProps) {
  if (deathYear === null) {
    return null;
  }

  const thisYear = currentYear ?? currentYearInJst();
  const anniversaries = allAnniversariesOf(
    { year: deathYear, month: deathMonth, day: deathDay },
    cutoff,
  );

  if (anniversaries.length === 0) {
    return null;
  }

  // 配列は回忌（=年）昇順。最初に「今年以降」になる回忌が直近の法要。
  const nextAnniversary = anniversaries.find((a) => a.year >= thisYear) ?? null;

  const containerClass =
    layout === 'scroll'
      ? 'flex gap-2 overflow-x-auto whitespace-nowrap pb-1'
      : 'flex flex-wrap gap-2';

  return (
    <div className={containerClass}>
      {anniversaries.map((ann) => {
        const isNext = nextAnniversary !== null && ann.kaiki === nextAnniversary.kaiki;
        return (
          <Badge
            key={ann.kaiki}
            variant={isNext ? 'info' : 'neutral'}
            showIcon={false}
            className={cn('shrink-0', !isNext && 'opacity-70')}
          >
            <span
              aria-hidden
              className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums',
                isNext ? 'bg-info text-info-foreground' : 'bg-muted-foreground/15',
              )}
            >
              {ann.kaiki}
            </span>
            {isNext && <span className="text-xs font-semibold">次の法要</span>}
            <span className="font-medium">{ann.name}</span>
            <span className="text-xs opacity-80">{formatAnniversaryLabel(ann)}</span>
          </Badge>
        );
      })}
    </div>
  );
}
