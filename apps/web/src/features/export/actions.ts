'use server';

import { requireCapability } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { withTenant } from '@/lib/db';
import {
  buildTable,
  csvToBytes,
  extensionFor,
  getExportEntity,
  mimeTypeFor,
  toCsv,
  toXlsx,
  type ExportFilter,
  type ExportFormat,
} from '@/lib/export';

export type ExportResult =
  | {
      status: 'ok';
      /** ファイル本体 (base64)。クライアントで Blob 化してダウンロードする。 */
      base64: string;
      fileName: string;
      mimeType: string;
      rowCount: number;
    }
  | { status: 'error'; message: string };

/** UTF-8 の YYYYMMDD (JST) をファイル名へ付与する。 */
function todayStampJst(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

/** number へ正規化 (空・非数値は null)。 */
function toNum(value: unknown): number | null {
  if (typeof value !== 'number') return null;
  return Number.isFinite(value) ? value : null;
}

/**
 * 指定エンティティのデータを取得し、CSV / Excel ファイル (base64) として返す。
 * - 書出権限が必要 (requireCapability('export'))。データ取得は withTenant + RLS 経由。
 * - 個人情報を含むため、エラー詳細・件数以外の中身はログへ出さない。
 */
export async function exportEntityAction(
  entityId: string,
  format: ExportFormat,
  filter: ExportFilter = {},
): Promise<ExportResult> {
  const def = getExportEntity(entityId);
  if (!def) {
    return { status: 'error', message: '書き出し対象が見つかりません。' };
  }
  if (format !== 'csv' && format !== 'xlsx') {
    return { status: 'error', message: '対応していない形式です。' };
  }

  const safeFilter: ExportFilter = {
    year: toNum(filter.year),
    month: toNum(filter.month),
    fromYear: toNum(filter.fromYear),
    toYear: toNum(filter.toYear),
  };

  const user = await requireCapability('export');
  const tenantId = user.tenantId;

  try {
    const { headers, rows } = await withTenant(tenantId, async (tx) => {
      const records = await def.fetchRows(tx, tenantId, safeFilter);
      const table = buildTable(def.columns, records);
      // 成功した書出のみ EXPORT 記録 (rowCount は集計後に確定)。個人情報は summary に載せない。
      await recordAudit(tx, tenantId, {
        actorId: user.id,
        action: 'EXPORT',
        entityType: 'Export',
        summary: `書出 (entity=${entityId}, format=${format}, ${table.rows.length}件)`,
      });
      return table;
    });

    const bytes =
      format === 'csv'
        ? csvToBytes(toCsv(headers, rows))
        : toXlsx(headers, rows, def.sheetName);

    const base64 = Buffer.from(bytes).toString('base64');
    const fileName = `${def.fileBaseName}_${todayStampJst()}.${extensionFor(format)}`;

    return {
      status: 'ok',
      base64,
      fileName,
      mimeType: mimeTypeFor(format),
      rowCount: rows.length,
    };
  } catch {
    // エラー詳細 (個人情報を含みうる) はログにもメッセージにも出さない。
    return {
      status: 'error',
      message: '書き出し中に問題が発生しました。お手数ですが時間をおいて再度お試しください。',
    };
  }
}
