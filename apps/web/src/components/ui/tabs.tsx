'use client';

import {
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

/**
 * 依存を増やさない最小の Tabs。WAI-ARIA Tabs パターン準拠。
 *
 * 設計上の肝:
 * - 全 TabsContent を DOM に出力し、非選択は CSS `hidden` で隠すだけ
 *   (条件レンダリングで unmount しない → 入力中フォーム状態やスクロール先 id が消えない)。
 * - paramKey 指定時は URL (?tab=) を単一ソースに controlled で動く
 *   (router.replace(scroll:false) でナビゲーションを起こさず server 再実行もしない)。
 * - roving tabindex + 矢印/Home/End キー操作・aria-selected/controls を省略しない。
 */

type TabsContextValue = {
  value: string;
  setValue: (next: string) => void;
  baseId: string;
  /** tablist 内の trigger value を登録順に保持し、矢印キー移動の順序を決める。 */
  registerTrigger: (value: string) => void;
  orderedValues: () => string[];
};

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext(component: string): TabsContextValue {
  const ctx = useContext(TabsContext);
  if (!ctx) {
    throw new Error(`<${component}> は <Tabs> の内側でのみ使用できます。`);
  }
  return ctx;
}

function panelId(baseId: string, value: string): string {
  return `${baseId}-panel-${value}`;
}

function triggerId(baseId: string, value: string): string {
  return `${baseId}-trigger-${value}`;
}

export type TabsProps = {
  /** 初期選択タブ (uncontrolled・URL 未指定時のフォールバック)。 */
  defaultValue: string;
  /** controlled で使う場合の現在値。 */
  value?: string;
  /** controlled / URL 同期時の変更通知。 */
  onValueChange?: (value: string) => void;
  /**
   * 指定すると URL クエリ (?{paramKey}=) を単一ソースにする。
   * 初期値は server 側の searchParams から defaultValue に反映しておくこと。
   */
  paramKey?: string;
  className?: string;
  children: ReactNode;
};

export function Tabs({
  defaultValue,
  value: controlledValue,
  onValueChange,
  paramKey,
  className,
  children,
}: TabsProps) {
  const baseId = useId();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);

  const urlValue = paramKey ? searchParams.get(paramKey) : null;

  // 優先順: controlled prop > URL クエリ > 内部 state。
  const value =
    controlledValue ?? (urlValue && urlValue.length > 0 ? urlValue : uncontrolledValue);

  const orderRef = useRef<string[]>([]);
  const registerTrigger = useCallback((triggerValue: string) => {
    if (!orderRef.current.includes(triggerValue)) {
      orderRef.current.push(triggerValue);
    }
  }, []);
  const orderedValues = useCallback(() => orderRef.current, []);

  const setValue = useCallback(
    (next: string) => {
      if (controlledValue === undefined) {
        setUncontrolledValue(next);
      }
      if (paramKey) {
        const params = new URLSearchParams(searchParams.toString());
        params.set(paramKey, next);
        const query = params.toString();
        router.replace(query ? `${pathname}?${query}` : pathname, {
          scroll: false,
        });
      }
      onValueChange?.(next);
    },
    [controlledValue, onValueChange, pathname, paramKey, router, searchParams],
  );

  const ctx = useMemo<TabsContextValue>(
    () => ({ value, setValue, baseId, registerTrigger, orderedValues }),
    [value, setValue, baseId, registerTrigger, orderedValues],
  );

  return (
    <TabsContext.Provider value={ctx}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export type TabsListProps = {
  /** スクリーンリーダー用ラベル (必須)。 */
  'aria-label': string;
  className?: string;
  children: ReactNode;
};

export function TabsList({
  'aria-label': ariaLabel,
  className,
  children,
}: TabsListProps) {
  const { value, setValue, orderedValues } = useTabsContext('TabsList');

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const order = orderedValues();
    if (order.length === 0) return;
    const currentIndex = order.indexOf(value);
    let nextIndex: number | null = null;
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = (currentIndex + 1) % order.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = (currentIndex - 1 + order.length) % order.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = order.length - 1;
        break;
      default:
        return;
    }
    if (nextIndex === null) return;
    const nextValue = order[nextIndex];
    if (nextValue === undefined) return;
    e.preventDefault();
    setValue(nextValue);
    // フォーカスを移動先タブに移す (roving tabindex)。
    const tabs = e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]');
    tabs[nextIndex]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={cn(
        'flex flex-wrap items-stretch gap-x-1 border-b border-border',
        className,
      )}
    >
      {children}
    </div>
  );
}

export type TabsTriggerProps = {
  value: string;
  className?: string;
  children: ReactNode;
};

export function TabsTrigger({ value, className, children }: TabsTriggerProps) {
  const ctx = useTabsContext('TabsTrigger');
  ctx.registerTrigger(value);
  const selected = ctx.value === value;

  return (
    <button
      type="button"
      role="tab"
      id={triggerId(ctx.baseId, value)}
      aria-selected={selected}
      aria-controls={panelId(ctx.baseId, value)}
      tabIndex={selected ? 0 : -1}
      onClick={() => ctx.setValue(value)}
      className={cn(
        'min-h-touch -mb-px inline-flex items-center whitespace-nowrap border-b-2 px-4 py-2 text-base font-medium transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        selected
          ? 'border-brand text-foreground'
          : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
        className,
      )}
    >
      {children}
    </button>
  );
}

export type TabsContentProps = {
  value: string;
  className?: string;
  children: ReactNode;
};

export function TabsContent({ value, className, children }: TabsContentProps) {
  const ctx = useTabsContext('TabsContent');
  const selected = ctx.value === value;

  return (
    <div
      role="tabpanel"
      id={panelId(ctx.baseId, value)}
      aria-labelledby={triggerId(ctx.baseId, value)}
      hidden={!selected}
      tabIndex={0}
      className={cn('focus-visible:outline-none', className)}
    >
      {children}
    </div>
  );
}
