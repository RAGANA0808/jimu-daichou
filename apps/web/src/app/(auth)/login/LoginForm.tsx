'use client';

import { useActionState } from 'react';
import { sendMagicLinkAction } from './actions';

const initialState = { status: 'idle', message: '' } as const;

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(
    sendMagicLinkAction,
    initialState,
  );

  return (
    <form action={formAction} noValidate className="space-y-4">
      <div className="space-y-2">
        <label
          htmlFor="email"
          className="block text-sm font-medium text-foreground"
        >
          メールアドレス
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={state.status === 'sent'}
          className="block w-full rounded border border-border px-3 py-2 text-base focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:bg-muted disabled:text-muted-foreground"
        />
      </div>

      <button
        type="submit"
        disabled={isPending || state.status === 'sent'}
        className="w-full inline-flex min-h-touch items-center rounded bg-brand px-4 py-2 font-medium text-brand-foreground transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? '送信中…' : 'ログイン用リンクを送る'}
      </button>

      {state.status === 'sent' && (
        <p
          role="status"
          className="rounded bg-green-50 px-3 py-2 text-sm text-green-800"
        >
          {state.message}
        </p>
      )}
      {state.status === 'error' && (
        <p
          role="alert"
          className="rounded bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
