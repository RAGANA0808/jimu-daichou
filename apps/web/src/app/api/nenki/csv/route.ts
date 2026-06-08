import { NextResponse, type NextRequest } from 'next/server';
import { requireCapability } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { withTenant } from '@/lib/db';
import { toCsv } from '@/lib/export';
import {
  findAnniversariesForYear,
  sortAnniversaries,
  type NenkiSortKey,
} from '@/features/nenki/queries';

// EXPORT 書出は権限 + 監査が要るので Node ランタイム。
export const runtime = 'nodejs';

function parseYear(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n) || n < 1800 || n > 2200) return null;
  return n;
}

function parseSort(raw: string | null): NenkiSortKey {
  return raw === 'kaimyo' ? 'kaimyo' : 'schedule';
}

function formatSchedule(month: number | null, day: number | null): string {
  if (month === null || day === null) return '';
  return `${month}月${day}日`;
}

function formatDeathDate(d: {
  year: number;
  month: number | null;
  day: number | null;
}): string {
  return `${d.year}/${d.month ?? ''}/${d.day ?? ''}`;
}

/**
 * 年忌表の CSV 書出 (N-2: 郵送外注・印刷手渡し用)。
 * - sort=kaimyo で戒名順、既定 (schedule) で予定日順。
 * - 書出権限 (export) + EXPORT 監査。個人情報は監査 summary に載せない。
 * - BOM 付き UTF-8 / RFC4180 エスケープは lib/export.toCsv に委譲。
 */
export async function GET(request: NextRequest): Promise<Response> {
  const year = parseYear(request.nextUrl.searchParams.get('year'));
  if (year === null) {
    return NextResponse.json({ error: 'invalid_year' }, { status: 400 });
  }
  const sortKey = parseSort(request.nextUrl.searchParams.get('sort'));

  const user = await requireCapability('export');
  const tenantId = user.tenantId;

  const matches = await findAnniversariesForYear(year);
  if (matches.length === 0) {
    return NextResponse.json(
      { error: 'no_anniversaries', message: `${year} 年に該当する年忌はありません。` },
      { status: 404 },
    );
  }

  const sorted = sortAnniversaries(matches, sortKey);

  const headers = ['回忌', '予定日', '世帯 (施主)', '俗名', '戒名', '命日'];
  const rows = sorted.map((m) => [
    m.anniversary.name,
    formatSchedule(m.anniversary.month, m.anniversary.day),
    m.householdName,
    m.secularName,
    m.kaimyoName ?? '',
    formatDeathDate(m.deathDate),
  ]);

  await withTenant(tenantId, (tx) =>
    recordAudit(tx, tenantId, {
      actorId: user.id,
      action: 'EXPORT',
      entityType: 'Export',
      summary: `年忌表 CSV 書出 (${year}年, sort=${sortKey}, ${rows.length}件)`,
    }),
  );

  const csv = toCsv(headers, rows);
  const sortLabel = sortKey === 'kaimyo' ? '戒名順' : '予定日順';
  const filename = encodeURIComponent(`年忌表_${year}年_${sortLabel}.csv`);

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename*=UTF-8''${filename}`,
      'Cache-Control': 'no-store',
    },
  });
}
