import { NextResponse, type NextRequest } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { requireCapability } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
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
  const user = await requireCapability('export');
  const tenantId = user.tenantId;

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

  // N+1 解消: 該当世帯の住所をまとめて 1 クエリで取得する (旧: 世帯ごとに findUnique)。
  const householdIds = Array.from(new Set(matches.map((m) => m.householdId)));
  const households = await withTenant(tenantId, (tx) =>
    tx.household.findMany({
      where: { id: { in: householdIds } },
      select: { id: true, postalCode: true, address: true },
    }),
  );
  const addrById = new Map(households.map((h) => [h.id, h]));

  // 世帯ごとにグループ化 (同世帯に複数年忌あれば 1 通にまとめる)
  const byHousehold = new Map<string, NoticeLetterTarget>();
  for (const m of matches) {
    const item = {
      secularName: m.secularName,
      kaimyoName: m.kaimyoName,
      kaikiName: m.anniversary.name,
      month: m.anniversary.month,
      day: m.anniversary.day,
    };
    const existing = byHousehold.get(m.householdId);
    if (existing) {
      existing.anniversaries.push(item);
      continue;
    }

    const household = addrById.get(m.householdId);
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

  // 成功した書出のみ EXPORT 記録。個人情報 (氏名・住所) は summary に載せない。
  await withTenant(tenantId, (tx) =>
    recordAudit(tx, tenantId, {
      actorId: user.id,
      action: 'EXPORT',
      entityType: 'Export',
      summary: `案内状 PDF 書出 (${year}年, ${data.targets.length}件)`,
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
