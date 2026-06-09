import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Button,
  Card,
  CardContent,
  PageHeader,
} from '@/components/ui';
import { can, getCurrentRole } from '@/lib/auth';
import {
  getCircuitTourById,
  listActiveUsersForAssignee,
  listStopCandidates,
  type CircuitStopWithRelations,
} from '@/features/junkai/queries';
import { StopListEditor } from '@/features/junkai/StopListEditor';
import { TourStatusControls } from '@/features/junkai/TourStatusControls';
import {
  CIRCUIT_TOUR_TYPE_LABELS,
} from '@/features/junkai/types';

/** @db.Date (UTC0時保存) を JST 基準の YYYY/M/D で整形する (getUTC* で読む)。 */
function formatJstDate(d: Date): string {
  return `${d.getUTCFullYear()}/${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

/** 区画 (plotNumber + 墓誌名) の表示ラベル。 */
function gravePlotLabel(plotNumber: string, monumentName: string | null): string {
  return monumentName && monumentName.length > 0
    ? `${plotNumber}（${monumentName}）`
    : plotNumber;
}

/** 訪問先の表示名: 世帯 → 区画 → 自由記述 → フォールバック。 */
function stopDisplayName(stop: CircuitStopWithRelations): string {
  if (stop.household) return stop.household.householderName;
  if (stop.gravePlot) {
    return gravePlotLabel(stop.gravePlot.plotNumber, stop.gravePlot.monumentName);
  }
  if (stop.visitLabel && stop.visitLabel.length > 0) return stop.visitLabel;
  return '（名称未設定）';
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">
        {value && value.length > 0 ? (
          value
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </dd>
    </>
  );
}

export default async function CircuitTourDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [tour, role] = await Promise.all([
    getCircuitTourById(id),
    getCurrentRole(),
  ]);
  if (!tour) {
    notFound();
  }

  const canEdit = role !== null && can(role, 'update');
  const canExport = role !== null && can(role, 'export');

  const [candidates, assignees] = await Promise.all([
    listStopCandidates(),
    listActiveUsersForAssignee(),
  ]);
  const assigneeNameById = new Map(assignees.map((a) => [a.id, a.name]));
  const assigneeName =
    tour.assignedUserId === null
      ? '（未割当）'
      : (assigneeNameById.get(tour.assignedUserId) ?? '（不明）');

  const householdOptions = candidates.households.map((h) => ({
    id: h.id,
    householderName: h.householderName,
  }));
  const gravePlotOptions = candidates.gravePlots.map((g) => ({
    id: g.id,
    label: g.area
      ? `${g.area.name} ${gravePlotLabel(g.plotNumber, g.monumentName)}`
      : gravePlotLabel(g.plotNumber, g.monumentName),
  }));

  const stops = tour.stops.map((s) => ({
    id: s.id,
    displayName: stopDisplayName(s),
    status: s.status,
    memo: s.memo,
  }));

  // シフト表は year/month 単位。実施日の年月を初期値にして新規タブで開く。
  const shiftYear = tour.scheduledDate.getUTCFullYear();
  const shiftMonth = tour.scheduledDate.getUTCMonth() + 1;

  return (
    <div className="space-y-6">
      <PageHeader
        title={tour.title}
        breadcrumbs={[
          { label: 'ダッシュボード', href: '/dashboard' },
          { label: '巡回', href: '/junkai' },
          { label: tour.title },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canExport && (
              <a
                href={`/api/junkai/shift?year=${shiftYear}&month=${shiftMonth}`}
                target="_blank"
                rel="noopener"
              >
                <Button variant="secondary">シフト表を印刷</Button>
              </a>
            )}
            {canEdit && (
              <Link href={`/junkai/${tour.id}/edit`}>
                <Button variant="secondary">編集</Button>
              </Link>
            )}
          </div>
        }
      />

      <Card>
        <CardContent className="space-y-4">
          <dl className="grid grid-cols-[6rem_1fr] gap-x-4 gap-y-2">
            <DetailRow label="種別" value={CIRCUIT_TOUR_TYPE_LABELS[tour.tourType]} />
            <DetailRow label="実施日" value={formatJstDate(tour.scheduledDate)} />
            <DetailRow label="担当者" value={assigneeName} />
          </dl>

          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">状況</p>
            <TourStatusControls
              circuitTourId={tour.id}
              status={tour.status}
              canEdit={canEdit}
            />
          </div>

          {tour.memo && (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">メモ</p>
              <p className="whitespace-pre-wrap text-sm text-foreground">
                {tour.memo}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-foreground">訪問先</h2>
        <p className="text-sm text-muted-foreground">
          上から順に巡る予定です。
          {canEdit && '↑↓ で並べ替え、不要な訪問先は「除外」できます。'}
        </p>
        <StopListEditor
          circuitTourId={tour.id}
          stops={stops}
          householdOptions={householdOptions}
          gravePlotOptions={gravePlotOptions}
          canEdit={canEdit}
        />
      </section>
    </div>
  );
}
