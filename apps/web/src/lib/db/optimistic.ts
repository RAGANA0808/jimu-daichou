/**
 * 楽観ロック (M-5)。`updatedAt` を突き合わせて同時編集の衝突を検出する。
 *
 * フォームには現在の `updatedAt` を epoch ms 文字列のトークンとして hidden で載せ、
 * 更新アクションでは withTenant トランザクション内で対象行の最新 `updatedAt` を取り直し、
 * `assertNotStale` でトークンと突き合わせる。不一致なら StaleError を throw してロールバックする。
 */

/** 楽観ロック衝突を表す判別可能エラー。action 側で isStaleError 判定して整形する。 */
export class StaleError extends Error {
  readonly isStaleError = true as const;
  constructor() {
    super('STALE');
    this.name = 'StaleError';
  }
}

/**
 * StaleError 判定。Server Action 境界をまたぐとプロトタイプが失われる場合があるため、
 * instanceof に加えてマーカープロパティでも判定する。
 */
export function isStaleError(e: unknown): e is StaleError {
  return (
    e instanceof StaleError ||
    (typeof e === 'object' &&
      e !== null &&
      'isStaleError' in e &&
      (e as { isStaleError?: unknown }).isStaleError === true)
  );
}

/** updatedAt をフォーム hidden に載せるトークン (epoch ms 文字列) に変換する。 */
export function toOptimisticToken(updatedAt: Date): string {
  return String(updatedAt.getTime());
}

/** 期待トークンと現在の updatedAt を突き合わせ、不一致なら StaleError を throw する。 */
export function assertNotStale(expectedToken: string, current: Date): void {
  if (expectedToken !== toOptimisticToken(current)) {
    throw new StaleError();
  }
}
