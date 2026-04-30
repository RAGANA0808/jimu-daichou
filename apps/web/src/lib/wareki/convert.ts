import { ERAS, findEraByCode } from './eras';
import type { SeirekiDate, WarekiDate } from './types';

function dateKey(year: number, month: number, day: number): number {
  return year * 10000 + month * 100 + day;
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}

export function seirekiToWareki(date: SeirekiDate): WarekiDate {
  const { year, month, day } = date;
  if (!isValidCalendarDate(year, month, day)) {
    throw new RangeError(`Invalid calendar date: ${year}-${month}-${day}`);
  }
  const key = dateKey(year, month, day);

  for (const era of ERAS) {
    const startKey = dateKey(era.startYear, era.startMonth, era.startDay);
    const endKey =
      era.endYear !== null && era.endMonth !== null && era.endDay !== null
        ? dateKey(era.endYear, era.endMonth, era.endDay)
        : Number.POSITIVE_INFINITY;
    if (key >= startKey && key <= endKey) {
      return {
        era: era.code,
        year: year - era.startYear + 1,
        month,
        day,
      };
    }
  }

  const meiji = ERAS[0]!;
  throw new RangeError(
    `Seireki date ${year}-${month}-${day} is before the Meiji era (pre-${meiji.startYear}-${meiji.startMonth}-${meiji.startDay})`,
  );
}

export function warekiToSeireki(date: WarekiDate): SeirekiDate {
  const era = findEraByCode(date.era);
  if (!Number.isInteger(date.year) || date.year < 1) {
    throw new RangeError(`Wareki year must be a positive integer: ${date.year}`);
  }
  const seirekiYear = era.startYear + date.year - 1;
  if (!isValidCalendarDate(seirekiYear, date.month, date.day)) {
    throw new RangeError(
      `Invalid calendar date for ${era.nameJa}${date.year}: month=${date.month}, day=${date.day}`,
    );
  }

  const key = dateKey(seirekiYear, date.month, date.day);
  const eraStartKey = dateKey(era.startYear, era.startMonth, era.startDay);
  if (key < eraStartKey) {
    throw new RangeError(
      `Date ${era.nameJa}${date.year}年${date.month}月${date.day}日 is before the era start`,
    );
  }
  if (era.endYear !== null && era.endMonth !== null && era.endDay !== null) {
    const eraEndKey = dateKey(era.endYear, era.endMonth, era.endDay);
    if (key > eraEndKey) {
      throw new RangeError(
        `Date ${era.nameJa}${date.year}年${date.month}月${date.day}日 is after the era end`,
      );
    }
  }

  return { year: seirekiYear, month: date.month, day: date.day };
}
