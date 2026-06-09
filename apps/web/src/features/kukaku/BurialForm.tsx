'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { createBurialAction } from './burial-actions';
import { initialBurialFormState } from './types';
import type { BurialCandidatePerson } from './burial-queries';

type Props = {
  gravePlotId: string;
  candidates: BurialCandidatePerson[];
  cancelHref: string;
  defaultInterredAt?: string;
};

/**
 * 納骨を記録するフォーム (区画詳細「納骨を記録」)。
 * 故人 (Person) を選び、納骨日・備考を入力する。
 * 区画の契約世帯に属する故人を上位に並べる (候補は server 側で並べ替え済み)。
 */
export function BurialForm({
  gravePlotId,
  candidates,
  cancelHref,
  defaultInterredAt,
}: Props) {
  const [state, formAction, isPending] = useActionState(
    createBurialAction,
    initialBurialFormState,
  );

  const personError = state.errors?.personId;
  const interredError = state.errors?.interredAt;
  const memoError = state.errors?.memo;

  const personValue = state.values?.personId ?? '';
  const interredValue = state.values?.interredAt ?? defaultInterredAt ?? '';
  const memoValue = state.values?.memo ?? '';

  return (
    <form action={formAction} noValidate className="space-y-5">
      <input type="hidden" name="gravePlotId" value={gravePlotId} />

      <div className="space-y-1">
        <label
          htmlFor="personId"
          className="block text-sm font-medium text-foreground"
        >
          納骨する故人<span className="ml-1 text-red-600">*</span>
        </label>
        <select
          id="personId"
          name="personId"
          required
          defaultValue={personValue}
          aria-invalid={personError ? 'true' : undefined}
          className="block w-full rounded border border-border px-3 py-2 text-base focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        >
          <option value="">選択してください</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.kaimyoName ? `（${c.kaimyoName}）` : ''} ／ {c.householderName} 家
            </option>
          ))}
        </select>
        {personError && <p className="text-sm text-red-700">{personError}</p>}
        {candidates.length === 0 && (
          <p className="text-sm text-muted-foreground">
            登録済みの家族構成員・故人がいません。先に世帯・過去帳をご登録ください。
          </p>
        )}
      </div>

      <div className="space-y-1">
        <label
          htmlFor="interredAt"
          className="block text-sm font-medium text-foreground"
        >
          納骨日
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            (不明の場合は空欄で構いません)
          </span>
        </label>
        <input
          id="interredAt"
          name="interredAt"
          type="date"
          defaultValue={interredValue}
          aria-invalid={interredError ? 'true' : undefined}
          className="block w-full rounded border border-border px-3 py-2 text-base focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />
        {interredError && (
          <p className="text-sm text-red-700">{interredError}</p>
        )}
      </div>

      <div className="space-y-1">
        <label
          htmlFor="memo"
          className="block text-sm font-medium text-foreground"
        >
          備考
        </label>
        <textarea
          id="memo"
          name="memo"
          rows={3}
          defaultValue={memoValue}
          aria-invalid={memoError ? 'true' : undefined}
          placeholder="分骨・改葬元など"
          className="block w-full rounded border border-border px-3 py-2 text-base focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />
        {memoError && <p className="text-sm text-red-700">{memoError}</p>}
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending || candidates.length === 0}
          className="inline-flex min-h-touch items-center rounded bg-brand px-4 py-2 font-medium text-brand-foreground transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? '記録中…' : '納骨を記録する'}
        </button>
        <Link
          href={cancelHref}
          className="rounded border border-border px-4 py-2 text-foreground hover:bg-muted"
        >
          キャンセル
        </Link>
      </div>
    </form>
  );
}
