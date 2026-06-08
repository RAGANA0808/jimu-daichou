import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Tailwind クラスを条件付きで結合し、衝突するユーティリティを後勝ちで解決する。
 * 共通 UI コンポーネント (components/ui) は全てこの関数で className をマージする。
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
