import { NextResponse, type NextRequest } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { requireCurrentTenantId } from '@/lib/auth';
import { withTenant } from '@/lib/db';
import { findAnniversariesForYear } from '@/features/nenki/queries';
import {
  NoticeLetterPdf,
  type NoticeLetterData,
  type NoticeLetterTarget,
} from '@/features/nenki/pdf/NoticeLetterPdf';

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

export async function GET(request: NextRequest): Promise<Response> {
  const year = parseYearParam(request.nextUrl.searchParams.get('year'));
  const tenantId = await requireCurrentTenantId();

  // テナント (寺院) 名を取得
  const tenant = await withTenant(tenantId, (tx) =>
    tx.tenant.findUnique({ where: { id: tenantId } }),
  );
  if (!tenant) {
    return NextResponse.json(
      { error: 'tenant_not_found' },
      { status: 404 },
    );
  }

  // 年忌表を再利用
  const matches = await findAnniversariesForYear(year);
  if (matches.length === 0) {
    return NextResponse.json(
      { error: 'no_anniversaries', message: `${year} 年に該当する年忌はありません。` },
      { status: 404 },
    );
  }

  // 世帯ごとにグループ化 (同世帯に複数年忌あれば 1 通にまとめる)
  const byHousehold = new Map<string, NoticeLetterTarget>();
  for (const m of matches) {
    const existing = byHousehold.get(m.householdId);
    const item = {
      secularName: m.secularName,
      kaimyoName: m.kaimyoName,
      kaikiName: m.anniversary.name,
      month: m.anniversary.month,
      day: m.anniversary.day,
    };
    if (existing) {
      existing.anniversaries.push(item);
      continue;
    }

    // 世帯の住所情報を取得する必要があるが、matches には載っていないので別途引く。
    // 少数前提なので N+1 クエリは許容範囲 (Phase 1)。
    const household = await withTenant(tenantId, (tx) =>
      tx.household.findUnique({
        where: { id: m.householdId },
        select: { postalCode: true, address: true },
      }),
    );

    byHousehold.set(m.householdId, {
      householdId: m.householdId,
      householderName: m.householdName,
      postalCode: household?.postalCode ?? null,
      address: household?.address ?? null,
      anniversaries: [item],
    });
  }

  const data: NoticeLetterData = {
    issuedAt: new Date(),
    temple: {
      name: tenant.name,
      headPriestName: tenant.headPriestName,
    },
    targets: Array.from(byHousehold.values()),
  };

  const pdfBuffer = await renderToBuffer(<NoticeLetterPdf data={data} />);

  const filename = `案内状_${year}年.pdf`;
  const encodedFilename = encodeURIComponent(filename);

  return new Response(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename*=UTF-8''${encodedFilename}`,
      'Cache-Control': 'no-store',
    },
  });
}
