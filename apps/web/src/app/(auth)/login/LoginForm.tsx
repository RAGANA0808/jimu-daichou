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
          className="block text-sm font-medium text-gray-700"
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
          className="block w-full rounded border border-gray-300 px-3 py-2 text-base focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 disabled:bg-gray-50 disabled:text-gray-500"
        />
      </div>

      <button
        type="submit"
        disabled={isPending || state.status === 'sent'}
        className="w-full rounded bg-gray-900 px-4 py-2 text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
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
