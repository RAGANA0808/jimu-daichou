import { cn } from '@/lib/utils';

/** 横スクロール可能なコンテナで囲んだテーブル本体。 */
export function Table({
  className,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto rounded-lg border border-border">
      <table
        className={cn('w-full border-collapse text-base', className)}
        {...props}
      />
    </div>
  );
}

export function TableHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  // せいざん踏襲: 濃いブランド橙の「塗り帯」見出し (白文字)。
  return (
    <thead
      className={cn('bg-brand text-brand-foreground', className)}
      {...props}
    />
  );
}

export function TableBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody
      className={cn('divide-y divide-border', className)}
      {...props}
    />
  );
}

export function TableRow({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  // 高情報密度: ゼブラ (偶数行に淡い地) + ホバーでブランド薄帯。
  return (
    <tr
      className={cn(
        'bg-surface transition-colors even:bg-muted/40 hover:bg-brand-soft',
        className,
      )}
      {...props}
    />
  );
}

export function TableHead({
  className,
  scope,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope={scope ?? 'col'}
      className={cn(
        'px-4 py-2.5 text-left text-sm font-semibold text-brand-foreground',
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn('px-4 py-2.5 text-foreground', className)}
      {...props}
    />
  );
}

export function TableCaption({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableCaptionElement>) {
  return (
    <caption
      className={cn('px-4 py-2 text-left text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}
