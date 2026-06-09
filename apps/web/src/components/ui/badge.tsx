import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * 状態バッジ。E13 基準: 状態を「色のみ」で伝えない。
 * 必ずアイコン (形) + テキストラベル + 色の 3 重で識別できるようにする。
 *
 * 各 variant は既定のアイコンを内蔵するため、利用側は意味ラベルを children に渡すだけでよい。
 * 例: <Badge variant="success">入金</Badge> / <Badge variant="warning">未確定</Badge>
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm font-medium',
  {
    variants: {
      variant: {
        // ブランド (パステル橙の薄帯 + 濃文字)。チップ/タグ/強調ラベル用。
        brand:
          'border-brand/30 bg-brand-soft text-brand-soft-foreground',
        success:
          'border-success/30 bg-success-soft text-success',
        warning:
          'border-warning/30 bg-warning-soft text-warning',
        danger: 'border-danger/30 bg-danger-soft text-danger',
        info: 'border-info/30 bg-info-soft text-info',
        neutral: 'border-border bg-muted text-muted-foreground',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  },
);

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>['variant']>;

/** variant ごとの既定アイコン (色覚に依存しない形での識別を担保)。 */
function BadgeIcon({ variant }: { variant: BadgeVariant }) {
  const common = {
    'aria-hidden': true as const,
    viewBox: '0 0 16 16',
    className: 'h-4 w-4 shrink-0',
    fill: 'currentColor' as const,
  };
  switch (variant) {
    case 'brand':
      // 丸ぽち (ブランド強調)。色覚に依存しない形で識別。
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="3.25" />
        </svg>
      );
    case 'success':
      return (
        <svg {...common}>
          <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-6 6a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 1 1 1.06-1.06L7.25 9.69l5.47-5.47a.75.75 0 0 1 1.06 0Z" />
        </svg>
      );
    case 'warning':
      return (
        <svg {...common}>
          <path d="M8 1.5a.75.75 0 0 1 .67.41l6 11.25A.75.75 0 0 1 14 14.25H2a.75.75 0 0 1-.67-1.09l6-11.25A.75.75 0 0 1 8 1.5Zm0 4a.75.75 0 0 0-.75.75v2.5a.75.75 0 0 0 1.5 0v-2.5A.75.75 0 0 0 8 5.5Zm0 5a.875.875 0 1 0 0 1.75.875.875 0 0 0 0-1.75Z" />
        </svg>
      );
    case 'danger':
      return (
        <svg {...common}>
          <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM5.72 5.72a.75.75 0 0 1 1.06 0L8 6.94l1.22-1.22a.75.75 0 1 1 1.06 1.06L9.06 8l1.22 1.22a.75.75 0 1 1-1.06 1.06L8 9.06 6.78 10.28a.75.75 0 0 1-1.06-1.06L6.94 8 5.72 6.78a.75.75 0 0 1 0-1.06Z" />
        </svg>
      );
    case 'info':
      return (
        <svg {...common}>
          <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM8 4a.875.875 0 1 1 0 1.75A.875.875 0 0 1 8 4Zm.75 3.5a.75.75 0 0 0-1.5 0v3.5a.75.75 0 0 0 1.5 0v-3.5Z" />
        </svg>
      );
    case 'neutral':
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="3" />
        </svg>
      );
  }
}

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants> & {
    /** false にすると既定アイコンを描画しない (独自アイコンを children で渡す場合)。 */
    showIcon?: boolean;
  };

export function Badge({
  className,
  variant,
  showIcon = true,
  children,
  ...props
}: BadgeProps) {
  const resolved: BadgeVariant = variant ?? 'neutral';
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {showIcon && <BadgeIcon variant={resolved} />}
      {children}
    </span>
  );
}

export { badgeVariants };
