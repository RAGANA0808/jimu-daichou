import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * 共通ボタン。
 * - タッチターゲット 44px 以上 (min-h-touch) を既定で確保。
 * - フォーカスリングを明示。color のみでなく形状/コントラストでも識別可能。
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        // 主要操作: ブランド橙 + 白文字 (AA)。ホバーでさらに濃い橙へ。
        primary:
          'bg-brand text-brand-foreground hover:bg-brand-hover',
        // 副操作: ブランド薄帯にホバーして温かみを出す。
        secondary:
          'border border-border bg-surface text-foreground hover:bg-brand-soft',
        danger:
          'bg-danger text-danger-foreground hover:bg-danger/90',
        ghost: 'text-foreground hover:bg-brand-soft',
        link: 'text-info underline-offset-4 hover:underline',
      },
      size: {
        md: 'min-h-touch px-4 py-2 text-base',
        lg: 'min-h-touch px-6 py-3 text-lg',
        sm: 'min-h-touch px-3 py-1.5 text-sm',
        icon: 'min-h-touch min-w-touch p-2',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ className, variant, size, type, ...props }, ref) {
    return (
      <button
        ref={ref}
        type={type ?? 'button'}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);

export { buttonVariants };
