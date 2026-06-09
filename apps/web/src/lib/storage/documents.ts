import 'server-only';
import { getStorageClient } from './client';

export const DOCUMENTS_BUCKET = 'documents';

// 署名付き URL の有効秒数 (プレビュー/DL は短命)。
const SIGNED_URL_TTL_SECONDS = 60; // 60 秒

/**
 * 非公開バケット documents の存在を冪等に保証する。
 *
 * 実装方針:
 * - モジュールスコープの Promise キャッシュで「一度成功したら以降スキップ」。
 * - getBucket → 無ければ createBucket(public:false)。並行呼び出しで作成競合しても
 *   "already exists" 系エラーは成功扱いにして握り潰す。
 * - allowedMimeTypes / fileSizeLimit はバケットには設定せず、アプリ層 (actions.ts) で検証する
 *   (将来の許可拡張をマイグレーションなしで行えるようにする)。
 */
let ensurePromise: Promise<void> | null = null;

export function ensureDocumentsBucket(): Promise<void> {
  if (ensurePromise) return ensurePromise;
  ensurePromise = (async () => {
    const supabase = getStorageClient();
    const { data, error } = await supabase.storage.getBucket(DOCUMENTS_BUCKET);
    if (data) return;
    // getBucket は未存在で error を返す。createBucket を試みる。
    const { error: createErr } = await supabase.storage.createBucket(
      DOCUMENTS_BUCKET,
      { public: false },
    );
    if (createErr && !/exist/i.test(createErr.message)) {
      ensurePromise = null; // 次回リトライできるようキャッシュ解除
      throw createErr;
    }
    // getBucket 側の error は createBucket 成功 (or already exists) で吸収する。
    void error;
  })();
  return ensurePromise;
}

export type UploadDocumentObjectInput = {
  storagePath: string; // tenantId/documentId/filename (呼び出し側が組み立てる)
  body: ArrayBuffer | Uint8Array | Blob;
  contentType: string;
};

/**
 * オブジェクトを documents バケットへアップロードする。
 * upsert:false (同一パス上書き禁止。documentId を含むパスなので衝突しない設計)。
 * 戻り値の path は DB の Document.storagePath に保存する。
 */
export async function uploadDocumentObject(
  input: UploadDocumentObjectInput,
): Promise<{ path: string }> {
  await ensureDocumentsBucket();
  const supabase = getStorageClient();
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(input.storagePath, input.body, {
      contentType: input.contentType,
      upsert: false,
    });
  if (error || !data) {
    throw new Error('書類の保存に失敗しました。');
  }
  return { path: data.path };
}

/**
 * プレビュー/ダウンロード用の短命 signed URL を発行する。
 * downloadName を渡すとファイル名つきダウンロードを促す (任意)。
 */
export async function createDocumentSignedUrl(
  storagePath: string,
  options?: { downloadName?: string },
): Promise<string> {
  const supabase = getStorageClient();
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS, {
      download: options?.downloadName ?? false,
    });
  if (error || !data?.signedUrl) {
    throw new Error('ダウンロード用リンクの発行に失敗しました。');
  }
  return data.signedUrl;
}

/**
 * オブジェクトを物理削除する。
 * 【用途限定】アップロード途中で DB 作成に失敗した場合のロールバック (cleanup) 専用。
 * 通常の「除外」(論理削除) では呼ばない (blob は保持する)。
 */
export async function removeDocumentObject(storagePath: string): Promise<void> {
  const supabase = getStorageClient();
  await supabase.storage.from(DOCUMENTS_BUCKET).remove([storagePath]);
  // cleanup なので失敗しても握り潰す (孤児 blob は許容、DB は正)。
}
