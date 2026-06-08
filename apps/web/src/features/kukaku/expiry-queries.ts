import 'server-only';
import type {
  GraveContractType,
  GravePlotStatus,
  GravePlotType,
} from '@prisma/client';
import { requireCurrentTenantId } from '@/lib/auth';
import { withTenant } from '@/lib/db';
import { isExpiringSoon, monthsUntil } from '@/lib/grave/contract';

/**
 * 合祀 (永代供養) 移行が「到来 / 間近」かつ未合祀の契約 (G-5)。案内漏れ防止のための読み取り専用抽出。
 *
 * 【特許回避】候補を出すだけで status を一切書き換えない。到来しても自動で INTERRED_TOGETHER に
 * しない (合祀移行は住職の手動確定 = expiry-actions.ts)。
 */
export type KyoshiCandidate = {
  gravePlotId: string;
  plotNumber: string;
  plotType: GravePlotType;
  plotStatus: GravePlotStatus;
  contractId: string;
  contractType: GraveContractType;
  expiryDate: Date; // null は対象外なので非 null
  monthsLeft: number; // 負数 = 満了済
  household: { id: string; householderName: string } | null;
};

/**
 * 合祀候補を満了日昇順 (緊急な順) で抽出する。
 *
 * - 未合祀の二重条件: 契約 status != TERMINATED (墓じまい済を除外) かつ
 *   区画 status != INTERRED_TOGETHER (合祀済を除外)。両方満たすものだけが案内対象。
 * - EXPIRED (満了済だが未合祀) は含める (案内漏れ防止の本命。monthsLeft 負で最優先表示)。
 * - 永代 (expiryDate=null) は満了日が無いため自動では候補に乗らない (詳細ページの操作は別途常時可)。
 * - @db.Date (UTC 00:00 保存) の境界計算は Date.UTC で月末を作り、最終判定は純粋関数 isExpiringSoon に
 *   委ねる (インライン比較禁止 / 9 時間ズレ回避)。cutoff は粗フィルタ。
 */
export async function listKyoshiCandidates(options?: {
  withinMonths?: number;
  now?: Date;
}): Promise<KyoshiCandidate[]> {
  const tenantId = await requireCurrentTenantId();
  const now = options?.now ?? new Date();
  const withinMonths = options?.withinMonths ?? 12;

  // 上限日 = now の withinMonths ヶ月後の月末まで (UTC)。day=0 で前月末。
  const cutoff = new Date(
    Date.UTC(now.getFullYear(), now.getMonth() + withinMonths + 1, 0),
  );

  const rows = await withTenant(tenantId, (tx) =>
    tx.graveContract.findMany({
      where: {
        deletedAt: null,
        status: { not: 'TERMINATED' },
        expiryDate: { not: null, lte: cutoff },
        gravePlot: { status: { not: 'INTERRED_TOGETHER' } },
      },
      select: {
        id: true,
        contractType: true,
        expiryDate: true,
        gravePlot: {
          select: { id: true, plotNumber: true, plotType: true, status: true },
        },
        household: { select: { id: true, householderName: true } },
      },
      orderBy: [{ expiryDate: 'asc' }],
    }),
  );

  const candidates: KyoshiCandidate[] = [];
  for (const r of rows) {
    // select の where で expiryDate=null は除外済みだが、型を非 null へ狭める。
    if (r.expiryDate === null) continue;
    // 最終判定は純粋関数に一本化 (cutoff は月末粗フィルタ)。
    if (!isExpiringSoon(r.expiryDate, withinMonths, now)) continue;
    const monthsLeft = monthsUntil(r.expiryDate, now);
    if (monthsLeft === null) continue;
    candidates.push({
      gravePlotId: r.gravePlot.id,
      plotNumber: r.gravePlot.plotNumber,
      plotType: r.gravePlot.plotType,
      plotStatus: r.gravePlot.status,
      contractId: r.id,
      contractType: r.contractType,
      expiryDate: r.expiryDate,
      monthsLeft,
      household: r.household,
    });
  }
  return candidates;
}

/** 合祀候補の件数 (ダッシュボードのバッジ / 一覧フィルタチップ用)。 */
export async function countKyoshiCandidates(options?: {
  withinMonths?: number;
  now?: Date;
}): Promise<number> {
  const candidates = await listKyoshiCandidates(options);
  return candidates.length;
}
