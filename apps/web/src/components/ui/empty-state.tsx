import { cn } from '@/lib/utils';

/**
 * データが無いときの空状態表示。
 * 高齢者向けに「何も無い」ではなく「次に何をすればよいか」を明示する。
 */
export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface px-6 py-12 text-center',
        className,
      )}
    >
      {icon && (
        <div className="mb-3 text-muted-foreground" aria-hidden="true">
          {icon}
        </div>
      )}
      <p className="font-rounded text-lg font-medium text-foreground">{title}</p>
      {description && (
        <p className="mt-1 max-w-md text-base text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
