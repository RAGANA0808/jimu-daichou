'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
} from 'react';
import { cn } from '@/lib/utils';

export type ToastVariant = 'success' | 'warning' | 'danger' | 'info';

export type ToastInput = {
  title: string;
  description?: string;
  variant?: ToastVariant;
  /** 自動で閉じるまでのミリ秒 (既定 5000)。0 で自動クローズしない。 */
  durationMs?: number;
};

type ToastItem = ToastInput & { id: number };

type ToastAction =
  | { type: 'add'; toast: ToastItem }
  | { type: 'remove'; id: number };

function reducer(state: ToastItem[], action: ToastAction): ToastItem[] {
  switch (action.type) {
    case 'add':
      return [...state, action.toast];
    case 'remove':
      return state.filter((t) => t.id !== action.id);
  }
}

type ToastContextValue = {
  toast: (input: ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

const VARIANT_CLASSES: Record<ToastVariant, string> = {
  success: 'border-success/30 bg-success-soft text-success',
  warning: 'border-warning/30 bg-warning-soft text-warning',
  danger: 'border-danger/30 bg-danger-soft text-danger',
  info: 'border-info/30 bg-info-soft text-info',
};

/**
 * Toast を表示するためのプロバイダ。アプリのルート ((main)/layout 等) に置く。
 * 高齢者向けに自動消滅は長め (既定 5 秒) かつ手動で閉じられる。
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, dispatch] = useReducer(reducer, []);

  const toast = useCallback((input: ToastInput) => {
    const id = nextId++;
    dispatch({ type: 'add', toast: { ...input, id } });
    const duration = input.durationMs ?? 5000;
    if (duration > 0) {
      setTimeout(() => dispatch({ type: 'remove', id }), duration);
    }
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2"
      >
        {toasts.map((t) => {
          const variant = t.variant ?? 'info';
          return (
            <div
              key={t.id}
              role="status"
              className={cn(
                'pointer-events-auto flex items-start gap-3 rounded-lg border bg-surface p-4 shadow-md',
                VARIANT_CLASSES[variant],
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground">{t.title}</p>
                {t.description && (
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {t.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                aria-label="通知を閉じる"
                onClick={() => dispatch({ type: 'remove', id: t.id })}
                className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 16 16"
                  className="h-4 w-4"
                  fill="currentColor"
                >
                  <path d="M4.22 4.22a.75.75 0 0 1 1.06 0L8 6.94l2.72-2.72a.75.75 0 1 1 1.06 1.06L9.06 8l2.72 2.72a.75.75 0 1 1-1.06 1.06L8 9.06l-2.72 2.72a.75.75 0 0 1-1.06-1.06L6.94 8 4.22 5.28a.75.75 0 0 1 0-1.06Z" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

/** Toast を発火するフック。ToastProvider 配下でのみ利用可能。 */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast は ToastProvider の内側で使ってください。');
  }
  return ctx;
}
