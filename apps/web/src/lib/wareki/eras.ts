export type EraCode = 'meiji' | 'taisho' | 'showa' | 'heisei' | 'reiwa';

export type EraDefinition = {
  readonly code: EraCode;
  readonly nameJa: string;
  readonly nameEn: string;
  readonly startYear: number;
  readonly startMonth: number;
  readonly startDay: number;
  readonly endYear: number | null;
  readonly endMonth: number | null;
  readonly endDay: number | null;
};

export const ERAS: readonly EraDefinition[] = [
  {
    code: 'meiji',
    nameJa: '明治',
    nameEn: 'Meiji',
    startYear: 1868,
    startMonth: 1,
    startDay: 25,
    endYear: 1912,
    endMonth: 7,
    endDay: 29,
  },
  {
    code: 'taisho',
    nameJa: '大正',
    nameEn: 'Taisho',
    startYear: 1912,
    startMonth: 7,
    startDay: 30,
    endYear: 1926,
    endMonth: 12,
    endDay: 24,
  },
  {
    code: 'showa',
    nameJa: '昭和',
    nameEn: 'Showa',
    startYear: 1926,
    startMonth: 12,
    startDay: 25,
    endYear: 1989,
    endMonth: 1,
    endDay: 7,
  },
  {
    code: 'heisei',
    nameJa: '平成',
    nameEn: 'Heisei',
    startYear: 1989,
    startMonth: 1,
    startDay: 8,
    endYear: 2019,
    endMonth: 4,
    endDay: 30,
  },
  {
    code: 'reiwa',
    nameJa: '令和',
    nameEn: 'Reiwa',
    startYear: 2019,
    startMonth: 5,
    startDay: 1,
    endYear: null,
    endMonth: null,
    endDay: null,
  },
] as const;

export function findEraByCode(code: EraCode): EraDefinition {
  const era = ERAS.find((e) => e.code === code);
  if (!era) {
    throw new Error(`Unknown era code: ${code}`);
  }
  return era;
}

export function findEraByJaName(nameJa: string): EraDefinition | null {
  return ERAS.find((e) => e.nameJa === nameJa) ?? null;
}
