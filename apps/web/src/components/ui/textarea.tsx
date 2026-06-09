import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className, rows, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        rows={rows ?? 3}
        className={cn(
          'block w-full rounded border border-border bg-surface px-3 py-2 text-base text-foreground placeholder:text-muted-foreground',
          'focus:border-brand focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-0',
          'disabled:cursor-not-allowed disabled:bg-muted',
          'aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger',
          className,
        )}
        {...props}
      />
    );
  },
);
