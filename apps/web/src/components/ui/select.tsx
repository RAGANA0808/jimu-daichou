import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

/**
 * 共通セレクト (ネイティブ <select>)。
 * Server Action の FormData にそのまま乗るネイティブ要素を採用。
 * 高齢者向けに矢印を大きめに描画し、タッチ高 44px を確保。
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, children, ...props },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          'block min-h-touch w-full appearance-none rounded border border-border bg-surface px-3 py-2 pr-10 text-base text-foreground',
          'focus:border-brand focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-0',
          'disabled:cursor-not-allowed disabled:bg-muted',
          'aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
          clipRule="evenodd"
        />
      </svg>
    </div>
  );
});
