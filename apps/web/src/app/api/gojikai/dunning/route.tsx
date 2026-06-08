import { NextResponse, type NextRequest } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { requireCurrentTenantId } from '@/lib/auth';
import { withTenant } from '@/lib/db';
import { listDunningCandidatesForYear } from '@/features/gojikai/queries';
import {
  DunningLetterPdf,
  type DunningLetterData,
} from '@/features/gojikai/pdf/DunningLetterPdf';

// @react-pdf/renderer は Node 依存 API を使うため Node ランタイムを強制。
export const runtime = 'nodejs';

function parseYear(raw: string | null): number | null {
  if (!raw || !/^\d{4}$/.test(raw)) return null;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n) || n < 2000 || n > 2200) return null;
  return n;
}

function pdfResponse(buffer: Buffer, filename: string): Response {
  const encoded = encodeURIComponent(filename);
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename*=UTF-8''${encoded}`,
      'Cache-Control': 'no-store',
    },
  });
}

export async function GET(request: NextRequest): Promise<Response> {
  const sp = request.nextUrl.searchParams;
  const year = parseYear(sp.get('year'));
  if (year === null) {
    return NextResponse.json({ error: 'invalid_year' }, { status: 400 });
  }

  const tenantId = await requireCurrentTenantId();

  // 宛先はサーバ側で再抽出する (クライアント送信値は信用しない)。
  const candidates = await listDunningCandidatesForYear(year);
  if (candidates.length === 0) {
    return NextResponse.json(
      {
        error: 'no_recipients',
        message: `${year} 年度に未集金の世帯がありません。`,
      },
      { status: 404 },
    );
  }

  const tenant = await withTenant(tenantId, (tx) =>
    tx.tenant.findUnique({ where: { id: tenantId } }),
  );
  if (!tenant) {
    return NextResponse.json({ error: 'tenant_not_found' }, { status: 404 });
  }

  const dueNoteRaw = sp.get('dueNote');
  const bodyNoteRaw = sp.get('bodyNote');

  const data: DunningLetterData = {
    issuedAt: new Date(),
    fiscalYear: year,
    temple: { name: tenant.name, headPriestName: tenant.headPriestName },
    dueNote: dueNoteRaw && dueNoteRaw.trim().length > 0 ? dueNoteRaw.trim() : null,
    bodyNote:
      bodyNoteRaw && bodyNoteRaw.trim().length > 0 ? bodyNoteRaw.trim() : null,
    recipients: candidates.map((c) => ({
      householdId: c.householdId,
      householderName: c.householderName,
      postalCode: c.postalCode,
      address: c.address,
      amount: c.amount,
      paidAmount: c.paidAmount,
      outstanding: c.outstanding,
    })),
  };

  const buffer = await renderToBuffer(<DunningLetterPdf data={data} />);
  return pdfResponse(buffer, `護持会費督促状_${year}年度.pdf`);
}
