export type Kaiki = 1 | 3 | 7 | 13 | 17 | 23 | 27 | 33 | 37 | 50;

/** 没日。月日は不明な場合 null を許容する（過去帳運用の現実に合わせる） */
export type DeathDate = {
  year: number;
  month: number | null;
  day: number | null;
};

export type Anniversary = {
  kaiki: Kaiki;
  name: string;
  year: number;
  /** 法要該当年における予定月 (命日の月)。月不明の場合は null */
  month: number | null;
  /** 法要該当年における予定日。命日の日または閏年補正後の日。不明の場合は null */
  day: number | null;
};
