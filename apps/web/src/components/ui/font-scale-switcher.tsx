'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export type FontScale = 'normal' | 'large' | 'xlarge';

const STORAGE_KEY = 'jimu-font-scale';

const OPTIONS: { value: FontScale; label: string; sample: string }[] = [
  { value: 'normal', label: '標準', sample: 'あ' },
  { value: 'large', label: '大', sample: 'あ' },
  { value: 'xlarge', label: '特大', sample: 'あ' },
];

function isFontScale(value: string | null): value is FontScale {
  return value === 'normal' || value === 'large' || value === 'xlarge';
}

function applyScale(scale: FontScale) {
  // normal は属性なし (CSS 既定 = 1.0)。large/xlarge は data 属性で globals.css が反映。
  if (scale === 'normal') {
    document.documentElement.removeAttribute('data-font-scale');
  } else {
    document.documentElement.setAttribute('data-font-scale', scale);
  }
}

/**
 * 本文サイズ「標準 / 大 / 特大」の 3 段階切替。
 * - localStorage に永続化し、ルート要素の data-font-scale を更新して全画面へ反映。
 * - DB マイグレーション不要 (端末ローカル設定)。
 */
export function FontScaleSwitcher({ className }: { className?: string }) {
  const [scale, setScale] = useState<FontScale>('normal');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isFontScale(stored)) {
      setScale(stored);
      applyScale(stored);
    }
  }, []);

  function handleChange(value: FontScale) {
    setScale(value);
    applyScale(value);
    localStorage.setItem(STORAGE_KEY, value);
  }

  return (
    <div
      role="group"
      aria-label="本文の文字サイズ"
      className={cn(
        'inline-flex items-center gap-1 rounded-md border border-border bg-surface p-1',
        className,
      )}
    >
      <span className="px-2 text-sm text-muted-foreground" aria-hidden="true">
        文字
      </span>
      {OPTIONS.map((opt) => {
        const active = scale === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => handleChange(opt.value)}
            className={cn(
              'min-h-touch min-w-touch rounded px-3 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-foreground hover:bg-muted',
              opt.value === 'normal' && 'text-base',
              opt.value === 'large' && 'text-lg',
              opt.value === 'xlarge' && 'text-xl',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * FOUC 回避用のインラインスクリプト。<head> 内で hydration 前に実行し、
 * 保存済みの文字サイズを即座に html 要素へ適用する。RootLayout で使う。
 */
export function FontScaleScript() {
  const code = `(function(){try{var s=localStorage.getItem('${STORAGE_KEY}');if(s==='large'||s==='xlarge'){document.documentElement.setAttribute('data-font-scale',s);}}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
