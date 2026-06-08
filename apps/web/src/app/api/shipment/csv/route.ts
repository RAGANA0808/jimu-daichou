import { NextResponse, type NextRequest } from 'next/server';
import { requireCapability } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { withTenant } from '@/lib/db';
import { buildAddressCsv } from '@/lib/shipment';
import { listShipmentCandidatesForYear } from '@/features/shipment/queries';

// 宛名 CSV は個人情報 (施主名・郵便番号・住所) の一括持出。
// 書出権限 (export) + EXPORT 監査を要するため Node ランタイム。
export const runtime = 'nodejs';

function parseYear(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n) || n < 1800 || n > 2200) return null;
  return n;
}

export async function GET(request: NextRequest): Promise<Response> {
  const year = parseYear(request.nextUrl.searchParams.get('year'));
  if (year === null) {
    return NextResponse.json({ error: 'invalid_year' }, { status: 400 });
  }

  const user = await requireCapability('export');
  const tenantId = user.tenantId;

  const candidates = await listShipmentCandidatesForYear(year);
  if (candidates.length === 0) {
    return NextResponse.json(
      {
        error: 'no_recipients',
        message: `${year} 年に該当する宛先がありません。`,
      },
      { status: 404 },
    );
  }

  const csv = buildAddressCsv(
    candidates.map((c) => ({
      householderName: c.householderName,
      postalCode: c.postalCode,
      address: c.address,
      summary: c.summary,
    })),
  );

  // Excel が UTF-8 を文字化けせず開けるよう BOM を付与する。
  const body = '﻿' + csv;
  const filename = encodeURIComponent(`宛名_${year}年.csv`);

  // 成功した書出のみ EXPORT 記録。個人情報 (氏名・住所) は summary に載せない。
  await withTenant(tenantId, (tx) =>
    recordAudit(tx, tenantId, {
      actorId: user.id,
      action: 'EXPORT',
      entityType: 'Export',
      summary: `宛名 CSV 書出 (${year}年, ${candidates.length}件)`,
    }),
  );

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename*=UTF-8''${filename}`,
      'Cache-Control': 'no-store',
    },
  });
}
