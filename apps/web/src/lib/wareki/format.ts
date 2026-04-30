import { findEraByCode } from './eras';
import type { SeirekiDate, WarekiDate } from './types';

export type FormatWarekiOptions = {
  /** 元号 1 年目を「元年」と表記するか (デフォルト: true) */
  useGannen?: boolean;
  /** 西暦を併記するか (デフォルト: false) */
  withSeireki?: boolean;
};

export function formatWareki(date: WarekiDate, options: FormatWarekiOptions = {}): string {
  const { useGannen = true, withSeireki = false } = options;
  const era = findEraByCode(date.era);
  const yearLabel = useGannen && date.year === 1 ? '元' : String(date.year);
  const base = `${era.nameJa}${yearLabel}年${date.month}月${date.day}日`;
  if (!withSeireki) return base;

  const seirekiYear = era.startYear + date.year - 1;
  return `${base} (${seirekiYear}/${date.month}/${date.day})`;
}

export function formatSeireki(date: SeirekiDate): string {
  return `${date.year}年${date.month}月${date.day}日`;
}
