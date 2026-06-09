import 'server-only';
import {
  getFinanceDashboardSummary,
  type FinanceDashboardSummary,
} from '@/features/kaikei/queries';
import {
  listUpcomingMemorialServices,
  type MemorialServiceWithHousehold,
} from '@/features/houyou/queries';
import {
  countGravePlotsByStatus,
  type GravePlotStatusCounts,
} from '@/features/kukaku/queries';
import {
  listRecentInteractionNotes,
  type RecentInteractionNote,
} from '@/features/danshintoto/interaction-queries';
import { findAnniversariesForYear, type AnniversaryMatch } from '@/features/nenki/queries';
import {
  listDunningCandidatesForYear,
  type DunningCandidate,
} from '@/features/gojikai/queries';
import { currentFiscalYear } from '@/features/gojikai/format';
import {
  listDemandCandidates,
  type DemandCandidate,
} from '@/features/bochi/queries';
import {
  listKyoshiCandidates,
  type KyoshiCandidate,
} from '@/features/kukaku/expiry-queries';
import {
  listPendingSuccessions,
  type PendingSuccession,
} from '@/features/danshintoto/succession-queries';

/**
 * JST の「今日 0:00」と当月の範囲を返す。
 * Asia/Tokyo は UTC+9 固定 (CLAUDE.md §4.3) なのでローカル時刻をそのまま使う。
 */
function jstBounds(now: Date): {
  todayStart: Date;
  tomorrowStart: Date;
  monthEndExclusive: Date;
  nextMonthEndExclusive: Date;
} {
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  );
  const monthEndExclusive = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonthEndExclusive = new Date(
    now.getFullYear(),
    now.getMonth() + 2,
    1,
  );
  return { todayStart, tomorrowStart, monthEndExclusive, nextMonthEndExclusive };
}

export type UpcomingServices = {
  /** 本日の法要 */
  today: MemorialServiceWithHousehold[];
  /** 今月 (本日以降〜月末) の法要 */
  thisMonth: MemorialServiceWithHousehold[];
  /** 来月 (翌月 1 日〜翌々月 1 日の手前) の法要。月末の見落とし防止の先回り表示用。 */
  nextMonth: MemorialServiceWithHousehold[];
};

/** 当年で本日以降に予定日を迎える年忌 (近い順、上限つき)。 */
export type UpcomingAnniversaries = AnniversaryMatch[];

/**
 * 未収サマリ。各既存クエリ (withTenant 済み) を件数・合計・上位数件に畳んだもの。
 * - gojikai: 当年度の護持会費 (未納・一部入金)。
 * - bochi: 全年度累積の墓地管理料 (滞納区画ベース)。
 */
export type OutstandingSummary = {
  fiscalYear: number;
  gojikai: { count: number; total: number; top: DunningCandidate[] };
  bochi: { count: number; total: number; top: DemandCandidate[] };
};

/** 合祀移行間近の候補サマリ (G-5)。件数と上位数件 (緊急な順)。 */
export type KyoshiSummary = {
  count: number;
  top: KyoshiCandidate[];
};

/** 承認待ちの承継候補サマリ。件数と上位数件 (交代発生日の新しい順)。 */
export type PendingSuccessionsSummary = {
  count: number;
  top: PendingSuccession[];
};

export type DashboardData = {
  services: UpcomingServices;
  upcomingAnniversaries: UpcomingAnniversaries;
  finance: FinanceDashboardSummary;
  plots: GravePlotStatusCounts;
  recentInteractions: RecentInteractionNote[];
  outstanding: OutstandingSummary;
  kyoshi: KyoshiSummary;
  pendingSuccessions: PendingSuccessionsSummary;
};

/**
 * ダッシュボードに必要なデータを並列取得する。
 * 各取得は対応する features の queries (すべて withTenant 経由) を集約するだけで、
 * ここでは直接 DB を触らない。
 */
export async function getDashboardData(
  now: Date = new Date(),
): Promise<DashboardData> {
  const { todayStart, tomorrowStart, monthEndExclusive, nextMonthEndExclusive } =
    jstBounds(now);
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  // 未収の年度起点は gojikai/bochi 各一覧ページと同じ算出 (暦年) に合わせる。
  const fiscalYear = currentFiscalYear(now);

  const [
    upcomingServices,
    finance,
    plots,
    recentInteractions,
    anniversaries,
    gojikaiUnpaid,
    bochiUnpaid,
    kyoshiCandidates,
    pendingSuccessions,
  ] = await Promise.all([
    listUpcomingMemorialServices(),
    getFinanceDashboardSummary(now),
    countGravePlotsByStatus(),
    listRecentInteractionNotes(8),
    findAnniversariesForYear(year),
    listDunningCandidatesForYear(fiscalYear),
    listDemandCandidates(fiscalYear),
    listKyoshiCandidates({ withinMonths: 12, now }),
    listPendingSuccessions(50),
  ]);

  const today = upcomingServices.filter(
    (s) => s.scheduledAt >= todayStart && s.scheduledAt < tomorrowStart,
  );
  const thisMonth = upcomingServices.filter(
    (s) => s.scheduledAt >= todayStart && s.scheduledAt < monthEndExclusive,
  );
  // 来月分は同じ取得結果 (本日以降 100 件) から窓を切るだけ。新規クエリは増やさない。
  const nextMonth = upcomingServices.filter(
    (s) =>
      s.scheduledAt >= monthEndExclusive &&
      s.scheduledAt < nextMonthEndExclusive,
  );

  // 年忌のうち、当年で本日以降に予定日を迎えるものに絞る (月日不明は対象外)。
  const upcomingAnniversaries = anniversaries
    .filter((a) => {
      const m = a.anniversary.month;
      const d = a.anniversary.day;
      if (m === null || d === null) return false;
      if (m > month) return true;
      if (m < month) return false;
      return d >= day;
    })
    .slice(0, 6);

  const outstanding: OutstandingSummary = {
    fiscalYear,
    gojikai: {
      count: gojikaiUnpaid.length,
      total: gojikaiUnpaid.reduce((sum, c) => sum + c.outstanding, 0),
      top: gojikaiUnpaid.slice(0, 5),
    },
    bochi: {
      count: bochiUnpaid.length,
      total: bochiUnpaid.reduce((sum, c) => sum + c.totalOutstanding, 0),
      top: bochiUnpaid.slice(0, 5),
    },
  };

  return {
    services: { today, thisMonth, nextMonth },
    upcomingAnniversaries,
    finance,
    plots,
    recentInteractions,
    outstanding,
    kyoshi: {
      count: kyoshiCandidates.length,
      top: kyoshiCandidates.slice(0, 5),
    },
    pendingSuccessions: {
      count: pendingSuccessions.length,
      top: pendingSuccessions.slice(0, 5),
    },
  };
}
