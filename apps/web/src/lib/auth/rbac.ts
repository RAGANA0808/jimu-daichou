import 'server-only';
import type { User } from '@prisma/client';
import type { UserRole } from '@prisma/client';
import { getCurrentUser, requireCurrentUser } from './session';
import { type Capability, can } from './rbac-core';

/**
 * RBAC (役割ベースアクセス制御) の権限ガード。
 *
 * Server Action / Server Component 専用 ('server-only')。
 * - 純粋ロジック (can / isReadOnly / 型) は ./rbac-core にあり、ここから再 export する。
 * - `requireCapability` / `getCurrentRole` は現ユーザーを解決する副作用つき関数。
 *
 * 【締め出し厳禁】HEAD_PRIEST は常に全許可 (完全バイパス)。capability の割当ミスが
 * あっても住職は決して締め出されない。READ_ONLY は read 以外を全拒否する。
 */

export { type Capability, can, isReadOnly } from './rbac-core';

/**
 * 現ユーザーを解決し、capability を満たさなければ例外を投げる。
 * 許可なら User を返す (後続で user.id / user.tenantId を再利用できる)。
 *
 * 未ログインは requireCurrentUser() の既存メッセージ「認証が必要です。」で弾く。
 * 例外メッセージには役割名・capability 名・氏名・対象 ID 等の個人情報/列挙情報を一切載せない。
 */
export async function requireCapability(capability: Capability): Promise<User> {
  const user = await requireCurrentUser();
  if (!user.isActive) {
    throw new Error('このアカウントは無効化されています。');
  }
  if (!can(user.role, capability)) {
    throw new Error('この操作の権限がありません。');
  }
  return user;
}

/**
 * 現ユーザーの役割を返す (UI/Server Component 用)。未ログインは null。
 * 例外を投げないので、ボタンの出し分け等に使える。
 */
export async function getCurrentRole(): Promise<UserRole | null> {
  const user = await getCurrentUser();
  return user?.role ?? null;
}
