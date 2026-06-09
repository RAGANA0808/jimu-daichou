'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button, Input } from '@/components/ui';
import type { DeathLedgerSort } from './queries';

/**
 * 横断一覧の検索ボックス + 並べ替え切替。
 * 状態は URL クエリ (?q=&sort=) に載せて共有・リロード耐性を持たせる。
 */
export function KakochouListControls({
  initialQuery,
  sort,
}: {
  initialQuery: string;
  sort: DeathLedgerSort;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [query, setQuery] = useState(initialQuery);
  const [isPending, startTransition] = useTransition();

  function pushParams(next: { q?: string; sort?: DeathLedgerSort }) {
    const sp = new URLSearchParams(params.toString());
    if (next.q !== undefined) {
      if (next.q.trim().length > 0) sp.set('q', next.q.trim());
      else sp.delete('q');
    }
    if (next.sort !== undefined) sp.set('sort', next.sort);
    startTransition(() => {
      router.push(`/kakochou${sp.toString() ? `?${sp.toString()}` : ''}`);
    });
  }

  return (
    <div className="space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          pushParams({ q: query });
        }}
        className="flex gap-2"
        role="search"
      >
        <Input
          name="q"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="戒名・俗名・ふりがなで検索"
          aria-label="過去帳を検索"
        />
        <Button type="submit" disabled={isPending}>
          検索
        </Button>
        {initialQuery.length > 0 && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setQuery('');
              pushParams({ q: '' });
            }}
          >
            クリア
          </Button>
        )}
      </form>

      <div
        className="inline-flex rounded-lg border border-border p-1"
        role="group"
        aria-label="並べ替え"
      >
        <SortTab
          active={sort === 'date'}
          onClick={() => pushParams({ sort: 'date' })}
          label="命日順"
        />
        <SortTab
          active={sort === 'kana'}
          onClick={() => pushParams({ sort: 'kana' })}
          label="かな順"
        />
        <SortTab
          active={sort === 'kaimyo'}
          onClick={() => pushParams({ sort: 'kaimyo' })}
          label="戒名順"
        />
      </div>
    </div>
  );
}

function SortTab({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? 'min-h-touch rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground'
          : 'min-h-touch rounded-md px-4 text-sm font-medium text-muted-foreground hover:bg-muted'
      }
    >
      {label}
    </button>
  );
}
