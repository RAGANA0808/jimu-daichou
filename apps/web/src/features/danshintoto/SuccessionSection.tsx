'use client';

import type { SuccessionReason, SuccessionStatus } from '@prisma/client';
import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { Button, FormField, Input } from '@/components/ui';
import {
  approveSuccessionAction,
  proposeSuccessionAction,
  rejectSuccessionAction,
} from './succession-actions';
import {
  initialSuccessionFormState,
  SUCCESSION_REASON_LABELS,
  SUCCESSION_REASON_ORDER,
  SUCCESSION_STATUS_LABELS,
  type SuccessionFormState,
} from './succession-types';

export type SuccessionItem = {
  id: string;
  reason: SuccessionReason;
  status: SuccessionStatus;
  previousHouseholderName: string | null;
  nextHouseholderName: string | null;
  occurredAt: string | null; // ISO 文字列 (UTC) または null
  note: string | null;
};

type Props = {
  householdId: string;
  successions: SuccessionItem[];
  /** 承認/却下が可能か (destructive)。false なら承認・却下ボタンを出さない。 */
  canManage: boolean;
  /** 承継候補の起票が可能か (create)。false なら「承継を記録」ボタンを出さない。 */
  canCreate: boolean;
};

function formatOccurredAt(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  // @db.Date は UTC 0 時で保存されるため getUTC* で読む (規約)。
  return `${d.getUTCFullYear()}/${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

const STATUS_BADGE_CLASS: Record<SuccessionStatus, string> = {
  PROPOSED: 'bg-amber-100 text-amber-900',
  APPROVED: 'bg-green-100 text-green-900',
  REJECTED: 'bg-muted text-muted-foreground',
};

export function SuccessionSection({
  householdId,
  successions,
  canManage,
  canCreate,
}: Props) {
  const [recording, setRecording] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const pendingCount = successions.filter(
    (s) => s.status === 'PROPOSED',
  ).length;

  function handleReject(id: string) {
    const fd = new FormData();
    fd.set('householdId', householdId);
    fd.set('successionId', id);
    startTransition(() => {
      void rejectSuccessionAction(fd);
    });
  }

  return (
    <div className="space-y-4">
      {pendingCount > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          承継候補が {pendingCount} 件あります。内容をご確認のうえ、次の施主を
          ご入力いただき承認してください。
        </div>
      )}

      {successions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          施主交代の記録はまだありません。お亡くなりや代替わりがあった際に、
          こちらへ承継として記録できます。
        </p>
      ) : (
        <div className="overflow-hidden rounded border border-border">
          <table className="w-full divide-y divide-border text-sm">
            <thead className="bg-brand text-left text-xs uppercase tracking-wider text-brand-foreground">
              <tr>
                <th className="px-4 py-2">発生日</th>
                <th className="px-4 py-2">事由</th>
                <th className="px-4 py-2">前施主</th>
                <th className="px-4 py-2">次施主</th>
                <th className="px-4 py-2">状態</th>
                <th className="px-4 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {successions.map((s) => (
                <tr key={s.id} className="align-top hover:bg-muted">
                  <td className="px-4 py-2 text-foreground">
                    {formatOccurredAt(s.occurredAt)}
                  </td>
                  <td className="px-4 py-2 text-foreground">
                    {SUCCESSION_REASON_LABELS[s.reason]}
                  </td>
                  <td className="px-4 py-2 text-foreground">
                    {s.previousHouseholderName ?? (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-foreground">
                    {s.nextHouseholderName ?? (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-xs ${STATUS_BADGE_CLASS[s.status]}`}
                    >
                      {SUCCESSION_STATUS_LABELS[s.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {s.status === 'PROPOSED' && canManage && (
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setApprovingId(approvingId === s.id ? null : s.id)
                          }
                          className="rounded border border-border px-2 py-1 text-xs text-foreground hover:bg-muted"
                        >
                          承認
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReject(s.id)}
                          className="rounded border border-red-300 px-2 py-1 text-xs text-red-800 hover:bg-red-50"
                        >
                          却下
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {approvingId && canManage && (
        <ApproveForm
          householdId={householdId}
          successionId={approvingId}
          defaultNextName={
            successions.find((s) => s.id === approvingId)
              ?.nextHouseholderName ?? ''
          }
          onClose={() => setApprovingId(null)}
        />
      )}

      {canCreate &&
        (recording ? (
          <RecordForm
            householdId={householdId}
            onDone={() => setRecording(false)}
            onCancel={() => setRecording(false)}
          />
        ) : (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setRecording(true)}
          >
            ＋ 承継を記録
          </Button>
        ))}
    </div>
  );
}

/**
 * 承認フォーム。担当者が次施主を確定し、任意で施主表示へ反映する。
 * 承認ボタン/フォームは canManage (destructive) のときのみ親が描画する (READ_ONLY/STAFF には非表示)。
 */
function ApproveForm({
  householdId,
  successionId,
  defaultNextName,
  onClose,
}: {
  householdId: string;
  successionId: string;
  defaultNextName: string;
  onClose: () => void;
}) {
  const [applyToHousehold, setApplyToHousehold] = useState(true);
  const [, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set('householdId', householdId);
    fd.set('successionId', successionId);
    fd.set('applyToHousehold', applyToHousehold ? 'true' : 'false');
    startTransition(() => {
      void approveSuccessionAction(fd);
      onClose();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-amber-300 bg-amber-50/60 p-4"
    >
      <p className="mb-3 text-sm font-medium text-foreground">
        承継を承認する（次の施主を確定します）
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="次の施主名" required>
          {(p) => (
            <Input
              id={p.id}
              name="nextHouseholderName"
              required
              maxLength={60}
              defaultValue={defaultNextName}
              placeholder="例: 山田 次郎"
            />
          )}
        </FormField>
        <FormField label="次の施主ふりがな" hint="施主表示に反映する場合に推奨">
          {(p) => (
            <Input
              id={p.id}
              name="nextNameKana"
              maxLength={60}
              aria-describedby={p.describedBy}
              placeholder="例: やまだ じろう"
            />
          )}
        </FormField>
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={applyToHousehold}
          onChange={(e) => setApplyToHousehold(e.target.checked)}
          className="h-4 w-4 rounded border-border"
        />
        この内容で世帯の施主名を更新する
      </label>
      <div className="mt-4 flex items-center gap-3">
        <Button type="submit" size="sm">
          承認して確定する
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onClose}>
          キャンセル
        </Button>
      </div>
    </form>
  );
}

/** 手動の承継記録フォーム (死亡を伴わない交代の起票)。status=PROPOSED で起票される。 */
function RecordForm({
  householdId,
  onDone,
  onCancel,
}: {
  householdId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [state, formAction, isPending] = useActionState<
    SuccessionFormState,
    FormData
  >(proposeSuccessionAction, initialSuccessionFormState);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    if (state.status === 'success') {
      doneRef.current();
    }
  }, [state.status]);

  return (
    <form
      action={formAction}
      className="rounded-lg border border-border bg-muted/40 p-4"
    >
      <input type="hidden" name="householdId" value={householdId} />
      <p className="mb-3 text-sm text-muted-foreground">
        記録すると「承継候補」として残ります。施主表示への反映は、後ほど承認操作で行います。
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="事由" error={state.errors?.reason}>
          {(p) => (
            <select
              id={p.id}
              name="reason"
              defaultValue={state.values?.reason ?? 'DEATH'}
              aria-describedby={p.describedBy}
              className="block w-full rounded border border-border px-3 py-2 text-base focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            >
              {SUCCESSION_REASON_ORDER.map((r) => (
                <option key={r} value={r}>
                  {SUCCESSION_REASON_LABELS[r]}
                </option>
              ))}
            </select>
          )}
        </FormField>
        <FormField label="発生日" error={state.errors?.occurredAt}>
          {(p) => (
            <Input
              id={p.id}
              name="occurredAt"
              type="date"
              defaultValue={state.values?.occurredAt ?? ''}
              aria-invalid={p.invalid}
              aria-describedby={p.describedBy}
            />
          )}
        </FormField>
        <FormField label="前施主名" error={state.errors?.previousHouseholderName}>
          {(p) => (
            <Input
              id={p.id}
              name="previousHouseholderName"
              maxLength={60}
              defaultValue={state.values?.previousHouseholderName ?? ''}
              aria-invalid={p.invalid}
              aria-describedby={p.describedBy}
              placeholder="例: 山田 太郎"
            />
          )}
        </FormField>
        <FormField label="次施主名（任意）" error={state.errors?.nextHouseholderName}>
          {(p) => (
            <Input
              id={p.id}
              name="nextHouseholderName"
              maxLength={60}
              defaultValue={state.values?.nextHouseholderName ?? ''}
              aria-invalid={p.invalid}
              aria-describedby={p.describedBy}
              placeholder="例: 山田 次郎"
            />
          )}
        </FormField>
      </div>
      <div className="mt-4">
        <FormField label="備考" error={state.errors?.note}>
          {(p) => (
            <Input
              id={p.id}
              name="note"
              maxLength={500}
              defaultValue={state.values?.note ?? ''}
              aria-invalid={p.invalid}
              aria-describedby={p.describedBy}
              placeholder="例: 転居に伴う代替わり"
            />
          )}
        </FormField>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? '記録中…' : '記録する'}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
          キャンセル
        </Button>
      </div>
    </form>
  );
}
