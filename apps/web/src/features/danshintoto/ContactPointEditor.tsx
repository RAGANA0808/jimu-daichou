'use client';

import { useActionState, useEffect, useId, useRef, useState, useTransition } from 'react';
import { Button, FormField, Input } from '@/components/ui';
import {
  createContactPointAction,
  deleteContactPointAction,
  reorderContactPointsAction,
  toggleContactPointPrimaryAction,
  updateContactPointAction,
} from './contact-point-actions';
import {
  CONTACT_RELATION_SUGGESTIONS,
  initialContactPointFormState,
  type ContactPointFormState,
} from './contact-point-types';

export type ContactPointItem = {
  id: string;
  personId: string | null;
  relationLabel: string;
  name: string | null;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  postalCode: string | null;
  address: string | null;
  note: string | null;
  isPrimary: boolean;
};

export type FamilyMemberOption = {
  id: string;
  name: string;
  familyRelation: string | null;
};

type Props = {
  householdId: string;
  contactPoints: ContactPointItem[];
  familyMembers: FamilyMemberOption[];
};

export function ContactPointEditor({
  householdId,
  contactPoints,
  familyMembers,
}: Props) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleDelete(id: string) {
    const fd = new FormData();
    fd.set('householdId', householdId);
    fd.set('contactPointId', id);
    startTransition(() => {
      void deleteContactPointAction(fd);
    });
  }

  function handleTogglePrimary(c: ContactPointItem) {
    const fd = new FormData();
    fd.set('householdId', householdId);
    fd.set('contactPointId', c.id);
    fd.set('isPrimary', c.isPrimary ? 'false' : 'true');
    startTransition(() => {
      void toggleContactPointPrimaryAction(fd);
    });
  }

  function handleMove(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= contactPoints.length) return;
    const ids = contactPoints.map((c) => c.id);
    const moved = ids[index]!;
    ids.splice(index, 1);
    ids.splice(target, 0, moved);
    startTransition(() => {
      void reorderContactPointsAction(householdId, ids);
    });
  }

  return (
    <div className="space-y-4">
      {contactPoints.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          まだ連絡先は登録されていません。第 2 連絡先・ご親族・成年後見人などを、
          人数の制限なくご登録いただけます。
        </p>
      ) : (
        <ul className="space-y-3">
          {contactPoints.map((c, i) =>
            editingId === c.id ? (
              <li key={c.id}>
                <ContactPointForm
                  householdId={householdId}
                  familyMembers={familyMembers}
                  initial={c}
                  onDone={() => setEditingId(null)}
                  onCancel={() => setEditingId(null)}
                />
              </li>
            ) : (
              <li
                key={c.id}
                className="rounded-lg border border-border bg-muted/30 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-xs text-foreground">
                        {c.relationLabel}
                      </span>
                      {c.isPrimary && (
                        <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-medium text-brand-foreground">
                          主たる連絡先
                        </span>
                      )}
                      {c.name && (
                        <span className="font-medium text-foreground">
                          {c.name}
                        </span>
                      )}
                    </div>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-sm">
                      {c.phone && (
                        <DetailLine label="電話" value={c.phone} />
                      )}
                      {c.mobile && (
                        <DetailLine label="携帯" value={c.mobile} />
                      )}
                      {c.email && (
                        <DetailLine label="メール" value={c.email} />
                      )}
                      {c.postalCode && (
                        <DetailLine label="〒" value={c.postalCode} />
                      )}
                      {c.address && (
                        <DetailLine label="住所" value={c.address} />
                      )}
                      {c.note && <DetailLine label="補足" value={c.note} />}
                    </dl>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <div className="flex gap-1">
                      <IconButton
                        label="上へ"
                        disabled={i === 0}
                        onClick={() => handleMove(i, -1)}
                      >
                        ↑
                      </IconButton>
                      <IconButton
                        label="下へ"
                        disabled={i === contactPoints.length - 1}
                        onClick={() => handleMove(i, 1)}
                      >
                        ↓
                      </IconButton>
                    </div>
                    <div className="flex gap-1">
                      <SmallButton onClick={() => handleTogglePrimary(c)}>
                        {c.isPrimary ? '主を解除' : '主に設定'}
                      </SmallButton>
                      <SmallButton onClick={() => setEditingId(c.id)}>
                        編集
                      </SmallButton>
                      <SmallButton
                        variant="danger"
                        onClick={() => handleDelete(c.id)}
                      >
                        除外
                      </SmallButton>
                    </div>
                  </div>
                </div>
              </li>
            ),
          )}
        </ul>
      )}

      {creating ? (
        <ContactPointForm
          householdId={householdId}
          familyMembers={familyMembers}
          onDone={() => setCreating(false)}
          onCancel={() => setCreating(false)}
        />
      ) : (
        <Button variant="secondary" size="sm" onClick={() => setCreating(true)}>
          ＋ 連絡先を追加
        </Button>
      )}
    </div>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words text-foreground">{value}</dd>
    </>
  );
}

function SmallButton({
  children,
  onClick,
  variant = 'default',
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'danger';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded border px-2 py-1 text-xs transition-colors ${
        variant === 'danger'
          ? 'border-red-300 text-red-800 hover:bg-red-50'
          : 'border-border text-foreground hover:bg-muted'
      }`}
    >
      {children}
    </button>
  );
}

function IconButton({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="rounded border border-border px-2 py-1 text-xs text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function ContactPointForm({
  householdId,
  familyMembers,
  initial,
  onDone,
  onCancel,
}: {
  householdId: string;
  familyMembers: FamilyMemberOption[];
  initial?: ContactPointItem;
  onDone: () => void;
  onCancel: () => void;
}) {
  const action = initial
    ? updateContactPointAction
    : createContactPointAction;
  const [state, formAction, isPending] = useActionState<
    ContactPointFormState,
    FormData
  >(action, initialContactPointFormState);
  const datalistId = useId();
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
      {initial && (
        <input type="hidden" name="contactPointId" value={initial.id} />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="続柄・役割" required error={state.errors?.relationLabel}>
          {(p) => (
            <>
              <Input
                id={p.id}
                name="relationLabel"
                list={datalistId}
                maxLength={60}
                defaultValue={
                  state.values?.relationLabel ?? initial?.relationLabel ?? ''
                }
                aria-invalid={p.invalid}
                aria-describedby={p.describedBy}
                placeholder="例: 第2連絡先 / 長男 / 嫁ぎ先"
              />
              <datalist id={datalistId}>
                {CONTACT_RELATION_SUGGESTIONS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </>
          )}
        </FormField>

        <FormField label="氏名" error={state.errors?.name}>
          {(p) => (
            <Input
              id={p.id}
              name="name"
              maxLength={60}
              defaultValue={state.values?.name ?? initial?.name ?? ''}
              aria-invalid={p.invalid}
              aria-describedby={p.describedBy}
              placeholder="例: 山田 一郎"
            />
          )}
        </FormField>

        <FormField label="電話">
          {(p) => (
            <Input
              id={p.id}
              name="phone"
              type="tel"
              defaultValue={state.values?.phone ?? initial?.phone ?? ''}
              aria-describedby={p.describedBy}
              placeholder="例: 03-1234-5678"
            />
          )}
        </FormField>

        <FormField label="携帯電話">
          {(p) => (
            <Input
              id={p.id}
              name="mobile"
              type="tel"
              defaultValue={state.values?.mobile ?? initial?.mobile ?? ''}
              aria-describedby={p.describedBy}
              placeholder="例: 090-1234-5678"
            />
          )}
        </FormField>

        <FormField label="メール" error={state.errors?.email}>
          {(p) => (
            <Input
              id={p.id}
              name="email"
              type="email"
              defaultValue={state.values?.email ?? initial?.email ?? ''}
              aria-invalid={p.invalid}
              aria-describedby={p.describedBy}
              placeholder="例: ichiro@example.com"
            />
          )}
        </FormField>

        <FormField label="郵便番号">
          {(p) => (
            <Input
              id={p.id}
              name="postalCode"
              defaultValue={
                state.values?.postalCode ?? initial?.postalCode ?? ''
              }
              aria-describedby={p.describedBy}
              placeholder="例: 123-4567"
            />
          )}
        </FormField>

        <FormField label="ご家族と紐付け">
          {(p) => (
            <select
              id={p.id}
              name="personId"
              defaultValue={initial?.personId ?? ''}
              className="block w-full rounded border border-border px-3 py-2 text-base focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            >
              <option value="">（紐付けない）</option>
              {familyMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.familyRelation ? `（${m.familyRelation}）` : ''}
                </option>
              ))}
            </select>
          )}
        </FormField>
      </div>

      <div className="mt-4">
        <FormField label="住所">
          {(p) => (
            <Input
              id={p.id}
              name="address"
              defaultValue={state.values?.address ?? initial?.address ?? ''}
              aria-describedby={p.describedBy}
              placeholder="例: 東京都○○区○○ 1-2-3"
            />
          )}
        </FormField>
      </div>

      <div className="mt-4">
        <FormField label="補足メモ" error={state.errors?.note}>
          {(p) => (
            <Input
              id={p.id}
              name="note"
              maxLength={500}
              defaultValue={state.values?.note ?? initial?.note ?? ''}
              aria-invalid={p.invalid}
              aria-describedby={p.describedBy}
              placeholder="例: 平日昼間は不在"
            />
          )}
        </FormField>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? '保存中…' : initial ? '更新する' : '追加する'}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
          キャンセル
        </Button>
      </div>
    </form>
  );
}
