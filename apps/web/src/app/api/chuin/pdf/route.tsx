import { NextResponse, type NextRequest } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { requireCapability } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { withTenant } from '@/lib/db';
import { chuinScheduleOf } from '@/lib/chuin';
import { getDeathLedgerEntryById } from '@/features/kakochou/queries';
import {
  ChuinTablePdf,
  type ChuinTableData,
} from '@/features/chuin/pdf/ChuinTablePdf';

// Node.js ランタイムを強制 (@react-pdf/renderer は Node 依存 API を使う)
export const runtime = 'nodejs';

export async function GET(request: NextRequest): Promise<Response> {
  const entryId = request.nextUrl.searchParams.get('entryId');
  if (!entryId) {
    return NextResponse.json(
      { error: 'entry_id_required' },
      { status: 400 },
    );
  }

  const user = await requireCapability('export');
  const tenantId = user.tenantId;

  const [tenant, entry] = await Promise.all([
    withTenant(tenantId, (tx) =>
      tx.tenant.findUnique({ where: { id: tenantId } }),
    ),
    getDeathLedgerEntryById(entryId),
  ]);

  if (!tenant) {
    return NextResponse.json({ error: 'tenant_not_found' }, { status: 404 });
  }
  if (!entry) {
    return NextResponse.json({ error: 'entry_not_found' }, { status: 404 });
  }

  // 中陰計算は命日 (年月日すべて判明) が前提。精度不足なら算出不可。
  if (
    entry.datePrecision !== 'FULL' ||
    entry.deathYear === null ||
    entry.deathMonth === null ||
    entry.deathDay === null
  ) {
    return NextResponse.json(
      {
        error: 'death_date_not_full',
        message: '中陰表の作成には命日（年月日）が必要です。',
      },
      { status: 422 },
    );
  }

  const schedule = chuinScheduleOf({
    year: entry.deathYear,
    month: entry.deathMonth,
    day: entry.deathDay,
  });

  const data: ChuinTableData = {
    issuedAt: new Date(),
    temple: {
      name: tenant.name,
      headPriestName: tenant.headPriestName,
    },
    deceased: {
      secularName: entry.secularName,
      kaimyoName: entry.kaimyoName,
      deathYear: entry.deathYear,
      deathMonth: entry.deathMonth,
      deathDay: entry.deathDay,
    },
    rows: schedule.map((c) => ({
      name: c.name,
      altName: c.altName,
      year: c.year,
      month: c.month,
      day: c.day,
    })),
  };

  const pdfBuffer = await renderToBuffer(<ChuinTablePdf data={data} />);

  const filename = `中陰表_${entry.secularName}.pdf`;
  const encodedFilename = encodeURIComponent(filename);

  // 成功した書出のみ EXPORT 記録。個人情報 (俗名・戒名) は summary に載せない。
  await withTenant(tenantId, (tx) =>
    recordAudit(tx, tenantId, {
      actorId: user.id,
      action: 'EXPORT',
      entityType: 'Export',
      summary: `中陰表 PDF 書出 (entryId=${entryId})`,
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
