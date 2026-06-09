import { NextResponse, type NextRequest } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { requireCapability } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { assertValidUuid, isValidUuid, withTenant } from '@/lib/db';
import {
  TobaReadingListPdf,
  type TobaReadingListData,
} from '@/features/toba/pdf/TobaReadingListPdf';

// Node.js ランタイムを強制 (@react-pdf/renderer は Node 依存 API を使う)
export const runtime = 'nodejs';

export async function GET(request: NextRequest): Promise<Response> {
  const memorialServiceId = request.nextUrl.searchParams.get(
    'memorialServiceId',
  );
  if (!memorialServiceId || !isValidUuid(memorialServiceId)) {
    return NextResponse.json(
      { error: 'invalid_memorial_service_id' },
      { status: 400 },
    );
  }
  assertValidUuid(memorialServiceId, 'memorialServiceId');

  const user = await requireCapability('export');
  const tenantId = user.tenantId;

  const result = await withTenant(tenantId, async (tx) => {
    const service = await tx.memorialService.findUnique({
      where: { id: memorialServiceId },
      include: {
        household: { select: { householderName: true } },
      },
    });
    if (!service) return null;

    const [tenant, tobas] = await Promise.all([
      tx.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      }),
      tx.toba.findMany({
        where: { memorialServiceId },
        include: {
          targetPerson: { select: { name: true } },
        },
        orderBy: [{ readingOrder: 'asc' }, { createdAt: 'asc' }],
      }),
    ]);

    return { service, tenant, tobas };
  });

  if (!result) {
    return NextResponse.json({ error: 'service_not_found' }, { status: 404 });
  }

  const data: TobaReadingListData = {
    templeName: result.tenant?.name ?? '',
    serviceName: result.service.serviceName,
    householderName: result.service.household.householderName,
    scheduledAt: result.service.scheduledAt,
    issuedAt: new Date(),
    items: result.tobas.map((t, i) => ({
      order: i + 1,
      inscription: t.inscription,
      applicantName: t.applicantName,
      targetPersonName: t.targetPerson?.name ?? null,
      count: t.count,
    })),
  };

  const pdfBuffer = await renderToBuffer(<TobaReadingListPdf data={data} />);

  const filename = `塔婆読上帳_${result.service.serviceName}.pdf`;
  const encodedFilename = encodeURIComponent(filename);

  // 成功した書出のみ EXPORT 記録。個人情報 (氏名) は summary に載せない。
  await withTenant(tenantId, (tx) =>
    recordAudit(tx, tenantId, {
      actorId: user.id,
      action: 'EXPORT',
      entityType: 'Export',
      summary: `塔婆読上帳 PDF 書出 (memorialServiceId=${memorialServiceId}, ${result.tobas.length}件)`,
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
