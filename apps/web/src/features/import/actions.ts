'use server';

import { revalidatePath } from 'next/cache';
import { requireCapability } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { withTenant } from '@/lib/db';
import {
  chunk,
  collectInsertableRecords,
  evaluateSheet,
  findUnmappedRequired,
  getImportEntity,
  guessMapping,
  parseUpload,
  type ColumnMapping,
  type ImportPreview,
  type ParsedSheet,
} from '@/lib/import';

const INSERT_BATCH_SIZE = 100;

export type ParseResult =
  | {
      status: 'ok';
      sheet: ParsedSheet;
      mapping: ColumnMapping;
    }
  | { status: 'error'; message: string };

/**
 * アップロードされた CSV/Excel をパースし、ヘッダ自動推測マッピングを返す。
 * DB アクセスなし (パースのみ)。
 */
export async function parseUploadAction(formData: FormData): Promise<ParseResult> {
  await requireCapability('read'); // ログイン + 有効アカウントの確認 (READ_ONLY も下見は可)
  const entityId = formData.get('entityId');
  const file = formData.get('file');

  if (typeof entityId !== 'string') {
    return { status: 'error', message: '取込対象が指定されていません。' };
  }
  const def = getImportEntity(entityId);
  if (!def) {
    return { status: 'error', message: '取込対象が見つかりません。' };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { status: 'error', message: 'ファイルを選択してください。' };
  }
  if (file.size > 10 * 1024 * 1024) {
    return { status: 'error', message: 'ファイルサイズが大きすぎます (上限 10MB)。' };
  }

  const parsed = await parseUpload(file);
  if (!parsed.ok) {
    return { status: 'error', message: parsed.error };
  }
  if (parsed.sheet.rows.length === 0) {
    return { status: 'error', message: 'データ行が見つかりませんでした。' };
  }

  const mapping = guessMapping(parsed.sheet.headers, def.columns);
  return { status: 'ok', sheet: parsed.sheet, mapping };
}

export type PreviewResult =
  | { status: 'ok'; preview: ImportPreview<unknown> }
  | { status: 'error'; message: string };

/**
 * マッピング済みシートを評価し、プレビュー (取込予定/警告/エラー行) を返す。
 * 既存データとの重複判定のためテナント内 DB を読む (withTenant 経由)。
 */
export async function previewImportAction(
  entityId: string,
  sheet: ParsedSheet,
  mapping: ColumnMapping,
): Promise<PreviewResult> {
  const def = getImportEntity(entityId);
  if (!def) {
    return { status: 'error', message: '取込対象が見つかりません。' };
  }

  const missing = findUnmappedRequired(def.columns, mapping);
  if (missing.length > 0) {
    return {
      status: 'error',
      message: `必須項目が未割当です: ${missing.map((c) => c.label).join('、')}`,
    };
  }

  const tenantId = (await requireCapability('read')).tenantId;
  const existing = await withTenant(tenantId, (tx) => def.loadExistingKeys(tx, tenantId));
  const preview = evaluateSheet(sheet, mapping, def, existing);
  return { status: 'ok', preview };
}

export type ConfirmResult =
  | { status: 'ok'; inserted: number; skipped: number }
  | { status: 'error'; message: string };

/**
 * 確定: error/重複を除いた行を一括登録する。
 * - 重複判定を確定時にも再評価する (プレビュー後の追加登録で状態が変わりうるため)。
 * - 大きめのデータでもバッチ分割して登録する。
 */
export async function confirmImportAction(
  entityId: string,
  sheet: ParsedSheet,
  mapping: ColumnMapping,
): Promise<ConfirmResult> {
  const def = getImportEntity(entityId);
  if (!def) {
    return { status: 'error', message: '取込対象が見つかりません。' };
  }

  const missing = findUnmappedRequired(def.columns, mapping);
  if (missing.length > 0) {
    return {
      status: 'error',
      message: `必須項目が未割当です: ${missing.map((c) => c.label).join('、')}`,
    };
  }

  const user = await requireCapability('create');
  const tenantId = user.tenantId;

  try {
    const result = await withTenant(tenantId, async (tx) => {
      // 確定時に最新の既存キーで再評価する (二重登録防止)。
      const existing = await def.loadExistingKeys(tx, tenantId);
      const preview = evaluateSheet(sheet, mapping, def, existing);
      const records = collectInsertableRecords(preview);

      let inserted = 0;
      for (const batch of chunk(records, INSERT_BATCH_SIZE)) {
        inserted += await def.insertBatch(tx, tenantId, batch);
      }
      const skipped = preview.counts.total - inserted;

      if (inserted > 0) {
        await recordAudit(tx, tenantId, {
          actorId: user.id,
          action: 'CREATE',
          entityType: 'Import',
          summary: `CSV/Excel 取込 (entity=${entityId}, ${inserted}件登録/${skipped}件除外)`,
        });
      }

      return { inserted, skipped };
    });

    revalidatePath('/danshintoto');
    revalidatePath('/kakochou');
    revalidatePath('/kukaku');
    revalidatePath('/kaikei');
    revalidatePath('/import');
    return { status: 'ok', inserted: result.inserted, skipped: result.skipped };
  } catch {
    // エラー詳細 (個人情報を含みうる) はログにもメッセージにも出さない。
    return {
      status: 'error',
      message: '登録中に問題が発生しました。お手数ですが時間をおいて再度お試しください。',
    };
  }
}
