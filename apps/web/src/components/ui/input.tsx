import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

/**
 * 共通テキスト入力。基準フォント 16px (iOS のズーム回避も兼ねる)、タッチ高 44px。
 * aria-invalid="true" のとき枠を danger 色にして視覚的に誤りを伝える。
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        'block min-h-touch w-full rounded border border-border bg-surface px-3 py-2 text-base text-foreground placeholder:text-muted-foreground',
        'focus:border-brand focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-0',
        'disabled:cursor-not-allowed disabled:bg-muted',
        'aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger',
        className,
      )}
      {...props}
    />
  );
});
