/**
 * 過去帳エントリの重複候補判定 (純関数)。
 *
 * 同一世帯に同名 (俗名の正規化一致) の故人が既に登録されている場合に警告するための照合。
 * DB アクセスは持たず、呼び出し側が候補リストを与える。
 */

// 葉モジュールから直接 import する。`@/lib/search` の index は server-only な
// queries も re-export するため、純関数 (lib/kakochou) から index 越しに引くと
// テスト (node) で server-only ガードに弾かれる。
import { normalizeKana } from '@/lib/search/normalize';

/**
 * 俗名の正規化キー。空白・中黒・全角半角ゆれを吸収して比較精度を上げる。
 * normalizeKana はかな寄せも行うが、俗名 (漢字) でも空白除去・全半角統一として有効。
 */
export function normalizeSecularName(value: string): string {
  return normalizeKana(value);
}

export type DuplicateCandidate = {
  /** 既存エントリ id */
  id: string;
  /** 既存エントリの俗名 */
  secularName: string;
};

/**
 * 同一世帯内で、与えた俗名と正規化一致する既存エントリを返す。
 * `excludeId` を渡すと自分自身 (編集時) を候補から除外する。
 */
export function findDuplicateBySecularName(
  secularName: string,
  candidates: readonly DuplicateCandidate[],
  excludeId?: string,
): DuplicateCandidate[] {
  const key = normalizeSecularName(secularName);
  if (key.length === 0) return [];
  return candidates.filter(
    (c) =>
      c.id !== excludeId && normalizeSecularName(c.secularName) === key,
  );
}
