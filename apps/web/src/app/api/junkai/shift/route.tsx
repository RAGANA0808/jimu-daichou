import { NextResponse, type NextRequest } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { requireCapability } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { withTenant } from '@/lib/db';
import {
  CIRCUIT_STOP_STATUS_LABELS,
  CIRCUIT_TOUR_STATUS_LABELS,
  CIRCUIT_TOUR_TYPE_LABELS,
} from '@/features/junkai/types';
import {
  ShiftTablePdf,
  type ShiftTableData,
} from '@/features/junkai/pdf/ShiftTablePdf';

// Node.js ランタイムを強制 (@react-pdf/renderer は Node 依存 API を使う)
export const runtime = 'nodejs';

function parseYearParam(raw: string | null): number {
  const now = new Date().getFullYear();
  if (!raw) return now;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n) || !Number.isFinite(n) || n < 1800 || n > 2200) {
    return now;
  }
  return n;
}

function parseMonthParam(raw: string | null): number {
  const current = new Date().getMonth() + 1;
  if (!raw) return current;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n) || !Number.isFinite(n) || n < 1 || n > 12) {
    return current;
  }
  return n;
}

/** 区画 (plotNumber + 墓誌名) の表示ラベル。 */
function gravePlotLabel(plotNumber: string, monumentName: string | null): string {
  return monumentName && monumentName.length > 0
    ? `${plotNumber}（${monumentName}）`
    : plotNumber;
}

export async function GET(request: NextRequest): Promise<Response> {
  const year = parseYearParam(request.nextUrl.searchParams.get('year'));
  const month = parseMonthParam(request.nextUrl.searchParams.get('month'));

  // 訪問先世帯名を含むため、書出 (個人情報持出) として export 権限でガードする。
  const user = await requireCapability('export');
  const tenantId = user.tenantId;

  // @db.Date は UTC0時保存。当月 [月初, 翌月初) の半開区間で抽出する。
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const nextMonthStart = new Date(Date.UTC(year, month, 1));

  const result = await withTenant(tenantId, async (tx) => {
    const [tenant, tours] = await Promise.all([
      tx.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      }),
      tx.circuitTour.findMany({
        where: {
          deletedAt: null,
          scheduledDate: { gte: monthStart, lt: nextMonthStart },
        },
        orderBy: { scheduledDate: 'asc' },
        include: {
          stops: {
            orderBy: { sortOrder: 'asc' },
            include: {
              household: { select: { householderName: true } },
              gravePlot: { select: { plotNumber: true, monumentName: true } },
            },
          },
        },
      }),
    ]);

    if (tours.length === 0) {
      return { tenant, tours, assigneeNameById: new Map<string, string>() };
    }

    // 担当者名を 1 クエリでまとめて解決する (N+1 回避)。
    const assigneeIds = Array.from(
      new Set(
        tours
          .map((t) => t.assignedUserId)
          .filter((v): v is string => v !== null),
      ),
    );
    const assignees =
      assigneeIds.length > 0
        ? await tx.user.findMany({
            where: { id: { in: assigneeIds } },
            select: { id: true, displayName: true },
          })
        : [];
    const assigneeNameById = new Map(
      assignees.map((u) => [u.id, u.displayName]),
    );

    return { tenant, tours, assigneeNameById };
  });

  if (result.tours.length === 0) {
    return NextResponse.json(
      {
        error: 'no_tours',
        message: `${year}年${month}月の巡回はありません。`,
      },
      { status: 404 },
    );
  }

  const data: ShiftTableData = {
    templeName: result.tenant?.name ?? '',
    year,
    month,
    issuedAt: new Date(),
    tours: result.tours.map((t) => ({
      scheduledDate: t.scheduledDate,
      title: t.title,
      tourTypeLabel: CIRCUIT_TOUR_TYPE_LABELS[t.tourType],
      assigneeName:
        t.assignedUserId === null
          ? null
          : (result.assigneeNameById.get(t.assignedUserId) ?? null),
      statusLabel: CIRCUIT_TOUR_STATUS_LABELS[t.status],
      stops: t.stops.map((s, i) => ({
        order: i + 1,
        name: s.household
          ? s.household.householderName
          : s.gravePlot
            ? gravePlotLabel(s.gravePlot.plotNumber, s.gravePlot.monumentName)
            : s.visitLabel && s.visitLabel.length > 0
              ? s.visitLabel
              : '（名称未設定）',
        statusLabel: CIRCUIT_STOP_STATUS_LABELS[s.status],
        memo: s.memo,
      })),
    })),
  };

  const pdfBuffer = await renderToBuffer(<ShiftTablePdf data={data} />);

  const filename = `シフト表_${year}年${month}月.pdf`;
  const encodedFilename = encodeURIComponent(filename);

  // 成功した書出のみ EXPORT 記録。氏名・担当者名など個人情報は summary に載せない。
  await withTenant(tenantId, (tx) =>
    recordAudit(tx, tenantId, {
      actorId: user.id,
      action: 'EXPORT',
      entityType: 'Export',
      summary: `シフト表 PDF 書出 (${year}年${month}月, ${result.tours.length}件)`,
    }),
  );

  return new Response(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename*=UTF-8''${encodedFilename}`,
      'Cache-Control': 'no-store',
    },
  });
}
