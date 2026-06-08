import { NextResponse, type NextRequest } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { requireCurrentTenantId } from '@/lib/auth';
import { isValidUuid } from '@/lib/db';
import {
  buildPostalSlip,
  clampOffsetMm,
  payableSlips,
  resolveSubjectLines,
  type HouseholdSourceAmounts,
  type PostalSlip,
  type SubjectTemplate,
} from '@/lib/postal-transfer';
import {
  getHouseholdLite,
  getInitialAmountsForYear,
  getPostalTransferAccount,
  listActiveHouseholds,
  listActiveSubjects,
} from '@/features/postal-transfer/queries';
import {
  PostalTransferPdf,
  PostalTransferWithDetailPdf,
  type PostalTransferPdfData,
} from '@/features/postal-transfer/pdf/PostalTransferPdf';

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

  const year = parseYear(sp.get('year')) ?? new Date().getFullYear();
  const withDetail = sp.get('detail') === '1';
  const showGuide = sp.get('guide') === '1';
  const householdIdParam = sp.get('householdId');

  await requireCurrentTenantId();

  const [account, subjectsRaw] = await Promise.all([
    getPostalTransferAccount(),
    listActiveSubjects(),
  ]);

  if (!account) {
    return NextResponse.json({ error: 'tenant_not_found' }, { status: 404 });
  }
  if (subjectsRaw.length === 0) {
    return NextResponse.json(
      {
        error: 'no_subjects',
        message: '科目が登録されていません。設定から科目を追加してください。',
      },
      { status: 404 },
    );
  }

  const subjects: SubjectTemplate[] = subjectsRaw.map((s) => ({
    id: s.id,
    name: s.name,
    defaultAmount: s.defaultAmount,
    isVisible: s.isVisible,
    amountSource: s.amountSource,
  }));

  const offset = {
    xMm: clampOffsetMm(account.postalPrintOffsetXMm),
    yMm: clampOffsetMm(account.postalPrintOffsetYMm),
  };
  const accountInfo = {
    accountName: account.postalAccountName ?? account.name,
    accountSymbol: account.postalAccountSymbol,
    accountNumber: account.postalAccountNumber,
    note: account.postalTransferNote,
  };

  const initialAmounts = await getInitialAmountsForYear(year);

  let slips: PostalSlip[] = [];

  if (householdIdParam && isValidUuid(householdIdParam)) {
    // 単票生成 (世帯詳細から)。任意で subjectId 別の金額上書きを受ける。
    const household = await getHouseholdLite(householdIdParam);
    if (!household) {
      return NextResponse.json({ error: 'household_not_found' }, { status: 404 });
    }
    const overrides = parseAmountOverrides(sp.get('amounts'));
    const sourceAmounts: HouseholdSourceAmounts =
      initialAmounts.get(household.id) ?? {};
    let lines = resolveSubjectLines(subjects, sourceAmounts);
    if (overrides) {
      lines = lines.map((l) =>
        l.subjectId in overrides
          ? { ...l, amount: overrides[l.subjectId]! }
          : l,
      );
    }
    slips = [
      buildPostalSlip({
        householdId: household.id,
        householderName: household.householderName,
        postalCode: household.postalCode,
        address: household.address,
        lines,
      }),
    ];
  } else {
    // 一括生成: 離檀していない (isActive=true) 世帯ぶん。金額はサーバ側で再解決する。
    const households = await listActiveHouseholds();
    slips = households.map((h) => {
      const sourceAmounts: HouseholdSourceAmounts =
        initialAmounts.get(h.id) ?? {};
      const lines = resolveSubjectLines(subjects, sourceAmounts);
      return buildPostalSlip({
        householdId: h.id,
        householderName: h.householderName,
        postalCode: h.postalCode,
        address: h.address,
        lines,
      });
    });
    // 合計 0 円の世帯は出力対象から外す。
    slips = payableSlips(slips);
  }

  if (slips.length === 0) {
    return NextResponse.json(
      {
        error: 'no_slips',
        message:
          '金額のある対象世帯がありません。科目の金額設定や当年度の請求をご確認ください。',
      },
      { status: 404 },
    );
  }

  const data: PostalTransferPdfData = {
    account: accountInfo,
    offset,
    showGuide,
    slips,
  };

  try {
    const element = withDetail ? (
      <PostalTransferWithDetailPdf data={data} />
    ) : (
      <PostalTransferPdf data={data} />
    );
    const buffer = await renderToBuffer(element);
    const filename = householdIdParam
      ? `郵便振替_${slips[0]!.householderName}_${year}年.pdf`
      : `郵便振替_一括_${year}年.pdf`;
    return pdfResponse(buffer, filename);
  } catch {
    // 個人情報をログに残さないため詳細はユーザーに返さない。
    return NextResponse.json(
      {
        error: 'pdf_generation_failed',
        message: 'PDF の生成に失敗しました。時間をおいて再度お試しください。',
      },
      { status: 500 },
    );
  }
}

/**
 * amounts クエリ (例: "id1:10000,id2:3000") を { subjectId: amount } にパースする。
 * 不正値は無視。返り値が空オブジェクトでも overrides として扱う。
 */
function parseAmountOverrides(
  raw: string | null,
): Record<string, number> | null {
  if (!raw) return null;
  const out: Record<string, number> = {};
  for (const pair of raw.split(',')) {
    const [id, amt] = pair.split(':');
    if (!id || !amt || !isValidUuid(id.trim())) continue;
    if (!/^\d+$/.test(amt.trim())) continue;
    const n = Number.parseInt(amt.trim(), 10);
    if (Number.isFinite(n) && n >= 0 && n <= 1_000_000_000) {
      out[id.trim()] = n;
    }
  }
  return out;
}
