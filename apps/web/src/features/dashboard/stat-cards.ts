import type { DashboardData } from './queries';
import type { StatCardConfig } from './StatCard';
import { formatYen } from './format';

/**
 * ダッシュボード上部の統計カード群を DashboardData から組み立てる。
 * カードの追加・並び替えはこの config リストの編集だけで完結する (ハードコード排除)。
 */
export function buildStatCards(data: DashboardData): StatCardConfig[] {
  const { services, upcomingAnniversaries, finance, plots } = data;

  const cards: StatCardConfig[] = [
    {
      key: 'today-services',
      label: '本日の法要',
      value: `${services.today.length} 件`,
      hint:
        services.today.length > 0
          ? '本日ご予定の法要があります'
          : '本日のご予定はありません',
      href: '/houyou',
      tone: services.today.length > 0 ? 'attention' : 'default',
    },
    {
      key: 'month-services',
      label: '今月の法要',
      value: `${services.thisMonth.length} 件`,
      hint: '本日以降〜月末のご予定',
      href: '/houyou',
    },
    {
      key: 'upcoming-anniversaries',
      label: '直近の年忌',
      value: `${upcomingAnniversaries.length} 件`,
      hint: '本年・本日以降に予定日を迎える年忌',
      href: '/nenki',
      tone: upcomingAnniversaries.length > 0 ? 'attention' : 'default',
    },
    {
      key: 'available-plots',
      label: '空き区画',
      value: `${plots.available} 区画`,
      hint: `全 ${plots.total} 区画中`,
      href: '/kukaku',
    },
    {
      key: 'month-income',
      label: '今月の収入',
      value: formatYen(finance.monthIncome),
      hint: `差引 ${formatYen(finance.monthNet)}`,
      href: '/kaikei',
      tone: finance.monthNet >= 0 ? 'positive' : 'attention',
    },
    {
      key: 'maintenance-fee',
      label: '本年の護持会費',
      value: formatYen(finance.maintenanceFeeTotalThisYear),
      hint: `${finance.maintenanceFeeCountThisYear} 件のご入金`,
      href: '/kaikei',
    },
  ];

  return cards;
}
