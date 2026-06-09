import { requireCurrentUser } from '@/lib/auth';
import { PageHeader } from '@/components/ui';
import { getDashboardData } from '@/features/dashboard/queries';
import { buildStatCards } from '@/features/dashboard/stat-cards';
import { StatCardGrid } from '@/features/dashboard/StatCard';
import {
  KyoshiCandidatesPanel,
  OutstandingPanel,
  PendingSuccessionsPanel,
  RecentInteractionsPanel,
  UpcomingAnniversariesPanel,
  UpcomingServicesPanel,
} from '@/features/dashboard/DashboardPanels';

export default async function DashboardPage() {
  const user = await requireCurrentUser();
  const data = await getDashboardData();
  const statCards = buildStatCards(data);

  return (
    <div className="space-y-4">
      <PageHeader
        title="ダッシュボード"
        description={`ようこそ、${user.displayName} さん。本日の気づきをまとめています。`}
      />

      <StatCardGrid items={statCards} />

      <div className="grid gap-4 xl:grid-cols-3">
        <UpcomingServicesPanel services={data.services} />
        <OutstandingPanel outstanding={data.outstanding} />
        <UpcomingAnniversariesPanel
          anniversaries={data.upcomingAnniversaries}
          nextYear={data.nextYearAnniversaries}
        />
        <KyoshiCandidatesPanel kyoshi={data.kyoshi} />
        <PendingSuccessionsPanel pendingSuccessions={data.pendingSuccessions} />
      </div>

      <RecentInteractionsPanel notes={data.recentInteractions} />
    </div>
  );
}
