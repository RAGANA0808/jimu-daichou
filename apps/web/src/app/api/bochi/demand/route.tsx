import { NextResponse, type NextRequest } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { requireCurrentTenantId } from '@/lib/auth';
import { withTenant } from '@/lib/db';
import { listDemandCandidates } from '@/features/bochi/queries';
import {
  DemandLetterPdf,
  type DemandLetterData,
} from '@/features/bochi/pdf/DemandLetterPdf';

// @react-pdf/renderer は Node 依存 API を使うため Node ランタイムを強制。
export const runtime = 'nodejs';

function parseYear(raw: string | null): number | null {
  if (!raw || !/^\d{4}$/.test(raw)) return null;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n) || n < 2000 || n > 2200) return null;
  return n;
}

function parseRound(raw: string | null): number {
  if (!raw || !/^\d{1,2}$/.test(raw)) return 1;
  return Math.min(20, Math.max(1, Number.parseInt(raw, 10)));
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
  const round = parseRound(sp.get('round'));

  const tenantId = await requireCurrentTenantId();

  // 宛先はサーバ側で再抽出する (クライアント送信値は信用しない)。
  // 宛名を解決できる (契約世帯あり) 区画のみ催告状を出力する。
  const candidates = await listDemandCandidates(year);
  const sendable = candidates.filter((c) => c.householdId !== null);
  if (sendable.length === 0) {
    return NextResponse.json(
      {
        error: 'no_recipients',
        message: `${year} 年度時点で、宛名を解決できる滞納区画がありません。`,
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

  const data: DemandLetterData = {
    issuedAt: new Date(),
    fiscalYear: year,
    round,
    temple: { name: tenant.name, headPriestName: tenant.headPriestName },
    dueNote:
      dueNoteRaw && dueNoteRaw.trim().length > 0 ? dueNoteRaw.trim() : null,
    bodyNote:
      bodyNoteRaw && bodyNoteRaw.trim().length > 0 ? bodyNoteRaw.trim() : null,
    recipients: sendable.map((c) => ({
      gravePlotId: c.gravePlotId,
      plotNumber: c.plotNumber,
      householderName: c.householderName ?? '（宛名未設定）',
      postalCode: c.postalCode,
      address: c.address,
      oldestUnpaidYear: c.oldestUnpaidYear,
      elapsedYears: c.elapsedYears,
      unpaidYearCount: c.unpaidYearCount,
      totalOutstanding: c.totalOutstanding,
    })),
  };

  const buffer = await renderToBuffer(<DemandLetterPdf data={data} />);
  return pdfResponse(buffer, `墓地管理料催告状_${year}年度_第${round}回.pdf`);
}
