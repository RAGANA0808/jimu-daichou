import { UserRole } from '@prisma/client';

/**
 * RBAC の純粋ロジック (役割階層・権限マトリクス)。
 *
 * `server-only` を付けず、副作用を持たないため Server / Client / テストのどこからでも
 * 安全に import できる。現ユーザー解決を伴うガード (requireCapability) は rbac.ts 側にある。
 *
 * 【締め出し厳禁】HEAD_PRIEST は常に全許可 (完全バイパス)。READ_ONLY は read のみ。
 */

/** 操作カテゴリ。Server Action はこのいずれかでガードする。 */
export type Capability =
  | 'read' // 閲覧・検索・PDF 閲覧
  | 'create' // 新規作成
  | 'update' // 編集
  | 'softDelete' // 論理削除 (除外)
  | 'export' // CSV/Excel 書出 (個人情報持出)
  | 'destructive' // 破壊的・不可逆寄り (改葬/離檀/承継承認/Google 連携)
  | 'admin'; // 管理操作 (役割変更・ユーザー有効/無効化・テナント設定)

/** 役割階層の数値ランク。HEAD_PRIEST > PRIEST > STAFF > READ_ONLY。 */
const ROLE_RANK: Record<UserRole, number> = {
  [UserRole.HEAD_PRIEST]: 3,
  [UserRole.PRIEST]: 2,
  [UserRole.STAFF]: 1,
  [UserRole.READ_ONLY]: 0,
};

/** capability ごとの最小必要ランク。HEAD_PRIEST はこの表を経由せずバイパスする。 */
const MIN_RANK: Record<Capability, number> = {
  read: ROLE_RANK[UserRole.READ_ONLY], // 0: 全員
  create: ROLE_RANK[UserRole.STAFF], // 1: 事務員以上
  update: ROLE_RANK[UserRole.STAFF], // 1
  softDelete: ROLE_RANK[UserRole.STAFF], // 1
  export: ROLE_RANK[UserRole.STAFF], // 1
  destructive: ROLE_RANK[UserRole.PRIEST], // 2: 僧侶以上
  admin: ROLE_RANK[UserRole.HEAD_PRIEST], // 3: 住職のみ
};

/**
 * 役割が capability を満たすか。HEAD_PRIEST は常に true (完全バイパス)。
 * 純粋関数なので UI のボタン出し分けにも使える。
 */
export function can(role: UserRole, capability: Capability): boolean {
  if (role === UserRole.HEAD_PRIEST) return true; // 完全バイパス (締め出し厳禁の核)
  return ROLE_RANK[role] >= MIN_RANK[capability];
}

/** 閲覧のみ役割か (変更系ボタンを隠す軽量判定)。 */
export function isReadOnly(role: UserRole): boolean {
  return role === UserRole.READ_ONLY;
}
