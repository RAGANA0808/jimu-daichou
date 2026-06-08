import { NextResponse, type NextRequest } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { requireCurrentTenantId } from '@/lib/auth';
import { withTenant } from '@/lib/db';
import { findLabelSheetSpec, parseLocalDate, parseLocalDateTime } from '@/lib/shipment';
import { listShipmentCandidatesForYear } from '@/features/shipment/queries';
import {
  AddressLabelPdf,
  type AddressLabelData,
} from '@/features/shipment/pdf/AddressLabelPdf';
import {
  EnvelopePdf,
  type EnvelopeData,
} from '@/features/shipment/pdf/EnvelopePdf';
import {
  MergedNoticeLetterPdf,
  type MergedNoticeData,
} from '@/features/shipment/pdf/MergedNoticeLetterPdf';

// @react-pdf/renderer は Node 依存 API を使うため Node ランタイムを強制。
export const runtime = 'nodejs';

const VALID_TYPES = ['notice', 'label', 'envelope'] as const;
type ShipmentPdfType = (typeof VALID_TYPES)[number];

function parseYear(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n) || n < 1800 || n > 2200) return null;
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
  const typeRaw = sp.get('type');
  const type = (VALID_TYPES as readonly string[]).includes(typeRaw ?? '')
    ? (typeRaw as ShipmentPdfType)
    : 'notice';

  const year = parseYear(sp.get('year'));
  if (year === null) {
    return NextResponse.json({ error: 'invalid_year' }, { status: 400 });
  }

  const tenantId = await requireCurrentTenantId();

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

  const tenant = await withTenant(tenantId, (tx) =>
    tx.tenant.findUnique({ where: { id: tenantId } }),
  );
  if (!tenant) {
    return NextResponse.json({ error: 'tenant_not_found' }, { status: 404 });
  }

  if (type === 'label') {
    const spec = findLabelSheetSpec(sp.get('sheet'));
    const data: AddressLabelData = {
      spec,
      items: candidates.map((c) => ({
        householderName: c.householderName,
        postalCode: c.postalCode,
        address: c.address,
      })),
    };
    const buffer = await renderToBuffer(<AddressLabelPdf data={data} />);
    return pdfResponse(buffer, `宛名ラベル_${year}年.pdf`);
  }

  if (type === 'envelope') {
    const data: EnvelopeData = {
      sender: {
        templeName: tenant.name,
        postalCode: null,
        address: null,
      },
      items: candidates.map((c) => ({
        householderName: c.householderName,
        postalCode: c.postalCode,
        address: c.address,
      })),
    };
    const buffer = await renderToBuffer(<EnvelopePdf data={data} />);
    return pdfResponse(buffer, `封筒宛名_${year}年.pdf`);
  }

  // type === 'notice'
  const serviceDateRaw = sp.get('serviceDate');
  const replyDeadlineRaw = sp.get('replyDeadline');
  const data: MergedNoticeData = {
    issuedAt: new Date(),
    temple: { name: tenant.name, headPriestName: tenant.headPriestName },
    serviceDate: serviceDateRaw ? parseLocalDateTime(serviceDateRaw) : null,
    location: sp.get('location'),
    offeringGuide: sp.get('offeringGuide'),
    replyDeadline: replyDeadlineRaw ? parseLocalDate(replyDeadlineRaw) : null,
    bodyNote: sp.get('bodyNote'),
    recipients: candidates.map((c) => ({
      householdId: c.householdId,
      householderName: c.householderName,
      postalCode: c.postalCode,
      address: c.address,
      summary: c.summary,
    })),
  };
  const buffer = await renderToBuffer(<MergedNoticeLetterPdf data={data} />);
  return pdfResponse(buffer, `案内状_${year}年.pdf`);
}
