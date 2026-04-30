import type { EraCode } from './eras';

export type SeirekiDate = {
  year: number;
  month: number;
  day: number;
};

export type WarekiDate = {
  era: EraCode;
  year: number;
  month: number;
  day: number;
};
