'use client';

import { UserRole } from '@prisma/client';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui';
import { USER_ROLE_LABELS } from './roles';
import type { TenantUserRow } from './role-management-queries';
import {
  changeUserRoleAction,
  toggleUserActiveAction,
} from './role-management-actions';

const ROLE_ORDER: UserRole[] = [
  UserRole.HEAD_PRIEST,
  UserRole.PRIEST,
  UserRole.STAFF,
  UserRole.READ_ONLY,
];

type Props = {
  users: TenantUserRow[];
};

export function RoleManagementSection({ users }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleRoleChange(userId: string, role: string) {
    const fd = new FormData();
    fd.set('userId', userId);
    fd.set('role', role);
    startTransition(async () => {
      const result = await changeUserRoleAction(fd);
      setError(result.status === 'error' ? result.message : null);
    });
  }

  function handleToggleActive(userId: string) {
    const fd = new FormData();
    fd.set('userId', userId);
    startTransition(async () => {
      const result = await toggleUserActiveAction(fd);
      setError(result.status === 'error' ? result.message : null);
    });
  }

  return (
    <div className="space-y-4">
      {error && (
        <p
          role="alert"
          className="rounded bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded border border-border">
        <table className="w-full divide-y divide-border text-sm">
          <thead className="bg-brand text-left text-xs uppercase tracking-wider text-brand-foreground">
            <tr>
              <th className="px-4 py-2">表示名</th>
              <th className="px-4 py-2">メールアドレス</th>
              <th className="px-4 py-2">役割</th>
              <th className="px-4 py-2">状態</th>
              <th className="px-4 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((u) => (
              <tr key={u.id} className="align-middle hover:bg-muted">
                <td className="px-4 py-2 text-foreground">
                  {u.displayName}
                  {u.isSelf && (
                    <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      ご自身
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-2">
                  <select
                    value={u.role}
                    disabled={isPending || !u.isActive}
                    onChange={(e) => handleRoleChange(u.id, e.target.value)}
                    className="block rounded border border-border px-2 py-1 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:opacity-50"
                  >
                    {ROLE_ORDER.map((r) => (
                      <option key={r} value={r}>
                        {USER_ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`inline-block rounded px-2 py-0.5 text-xs ${
                      u.isActive
                        ? 'bg-green-100 text-green-900'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {u.isActive ? '有効' : '無効'}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={isPending || u.isSelf}
                    onClick={() => handleToggleActive(u.id)}
                  >
                    {u.isActive ? '無効化' : '有効化'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        役割変更・有効/無効化は住職のみが行えます。新しい寺族アカウントの招待は今後のアップデートで対応予定です。
      </p>
    </div>
  );
}
