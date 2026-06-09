import { useId } from 'react';
import { cn } from '@/lib/utils';

type FormFieldRenderProps = {
  /** 子の入力要素に渡す id (label と紐付く)。 */
  id: string;
  /** エラー時に aria-describedby で参照させるメッセージ要素 id。 */
  describedBy: string | undefined;
  /** エラーがあるとき "true"。input の aria-invalid に渡す。 */
  invalid: 'true' | undefined;
};

export type FormFieldProps = {
  label: string;
  /** 必須マーク (*) を表示する。 */
  required?: boolean;
  error?: string;
  /** 補足説明 (ラベル下、入力上に表示)。 */
  hint?: string;
  className?: string;
  /**
   * 入力要素を render prop で受け取り、id / aria 属性を配線する。
   * 例:
   *   <FormField label="金額" required error={err}>
   *     {(p) => <Input id={p.id} aria-invalid={p.invalid} aria-describedby={p.describedBy} />}
   *   </FormField>
   */
  children: (props: FormFieldRenderProps) => React.ReactNode;
};

/**
 * ラベル + 入力 + エラー/ヒントを aria で正しく結線する共通フィールド。
 * アクセシビリティ (label の for, aria-invalid, aria-describedby) を一箇所で担保する。
 */
export function FormField({
  label,
  required,
  error,
  hint,
  className,
  children,
}: FormFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <div className={cn('space-y-1.5', className)}>
      <label
        htmlFor={id}
        className="block text-base font-medium text-foreground"
      >
        {label}
        {required && (
          <span className="ml-1 text-danger" aria-hidden="true">
            *
          </span>
        )}
        {required && <span className="sr-only">(必須)</span>}
      </label>
      {hint && !error && (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {children({
        id,
        describedBy,
        invalid: error ? 'true' : undefined,
      })}
      {error && (
        <p id={errorId} className="flex items-center gap-1 text-sm text-danger">
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            className="h-4 w-4 shrink-0"
            fill="currentColor"
          >
            <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM7.25 4.75a.75.75 0 0 1 1.5 0v3.5a.75.75 0 0 1-1.5 0v-3.5ZM8 10.5a.875.875 0 1 0 0 1.75.875.875 0 0 0 0-1.75Z" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}
