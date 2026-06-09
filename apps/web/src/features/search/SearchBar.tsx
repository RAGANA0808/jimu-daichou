'use client';

import { useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import type {
  DeathLedgerSearchResult,
  GravePlotSearchResult,
  HouseholdSearchResult,
  NoteSearchResult,
  SearchResults,
} from '@/lib/search/types';

const DEBOUNCE_MS = 200;

const EMPTY_SEARCH_RESULTS: SearchResults = {
  households: [],
  deathLedgerEntries: [],
  gravePlots: [],
  noteHits: [],
};

type FlatResult =
  | { kind: 'household'; item: HouseholdSearchResult; href: string }
  | {
      kind: 'deathLedgerEntry';
      item: DeathLedgerSearchResult;
      href: string;
    }
  | { kind: 'gravePlot'; item: GravePlotSearchResult; href: string }
  | { kind: 'noteHit'; item: NoteSearchResult; href: string };

function flatten(results: SearchResults): FlatResult[] {
  const households: FlatResult[] = results.households.map((item) => ({
    kind: 'household',
    item,
    href: `/danshintoto/${item.id}`,
  }));
  const entries: FlatResult[] = results.deathLedgerEntries.map((item) => ({
    kind: 'deathLedgerEntry',
    item,
    href: `/danshintoto/${item.householdId}/kakochou/${item.id}`,
  }));
  const plots: FlatResult[] = results.gravePlots.map((item) => ({
    kind: 'gravePlot',
    item,
    href: `/kukaku/${item.id}`,
  }));
  const notes: FlatResult[] = results.noteHits.map((item) => ({
    kind: 'noteHit',
    item,
    // 履歴一致は対応履歴タブ、メモ一致は概要タブへ遷移する。
    href:
      item.source === 'interaction'
        ? `/danshintoto/${item.householdId}?tab=interactions`
        : `/danshintoto/${item.householdId}`,
  }));
  return [...households, ...entries, ...plots, ...notes];
}

/**
 * ヘッダー常設の横断検索バー (E01)。
 *
 * 入力に応じてインクリメンタルに /api/search を叩き、世帯 (名前かな・電話) と
 * 過去帳 (戒名・俗名) のサジェストを出す。結果クリックまたは Enter で詳細へ遷移。
 * recognition over recall: 上位候補のみを提示し、矢印キーで選べる。
 */
export function SearchBar() {
  const router = useRouter();
  const listboxId = useId();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const flat = results ? flatten(results) : [];
  const hasResults = flat.length > 0;
  const trimmed = query.trim();

  // debounce 付きインクリメンタル取得
  useEffect(() => {
    if (trimmed.length === 0) {
      setResults(null);
      setLoading(false);
      abortRef.current?.abort();
      return;
    }

    const timer = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);

      fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
        signal: controller.signal,
      })
        .then((res) => {
          if (!res.ok) throw new Error('search failed');
          return res.json() as Promise<SearchResults>;
        })
        .then((data) => {
          setResults(data);
          setActiveIndex(-1);
          setLoading(false);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          setResults(EMPTY_SEARCH_RESULTS);
          setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [trimmed]);

  // 外側クリックで閉じる
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const goTo = useCallback(
    (href: string) => {
      setOpen(false);
      setQuery('');
      setResults(null);
      router.push(href);
    },
    [router],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (!open || flat.length === 0) {
        if (e.key === 'ArrowDown' && trimmed.length > 0) setOpen(true);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % flat.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => (i <= 0 ? flat.length - 1 : i - 1));
      } else if (e.key === 'Enter') {
        const target = activeIndex >= 0 ? flat[activeIndex] : flat[0];
        if (target) {
          e.preventDefault();
          goTo(target.href);
        }
      }
    },
    [open, flat, activeIndex, goTo, trimmed],
  );

  const showPanel = open && trimmed.length > 0;

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <Input
        type="search"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined
        }
        placeholder="お名前・電話・戒名・墓標名・履歴/メモで検索"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (trimmed.length > 0) setOpen(true);
        }}
        onKeyDown={onKeyDown}
        aria-label="横断検索"
      />

      {showPanel && (
        <div
          className="absolute left-0 right-0 z-50 mt-1 max-h-[70vh] overflow-auto rounded-lg border border-border bg-surface shadow-lg"
          role="listbox"
          id={listboxId}
        >
          {loading && !hasResults && (
            <p className="px-4 py-3 text-base text-muted-foreground">
              検索しております…
            </p>
          )}

          {!loading && !hasResults && (
            <div className="p-4">
              <EmptyState
                title="該当する記録が見つかりませんでした"
                description="お名前・お電話番号・戒名・俗名・履歴やメモの本文のいずれかで、表記を変えてお試しください。"
              />
            </div>
          )}

          {hasResults && results && (
            <ResultList
              results={results}
              listboxId={listboxId}
              activeIndex={activeIndex}
              onSelect={goTo}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ResultList({
  results,
  listboxId,
  activeIndex,
  onSelect,
}: {
  results: SearchResults;
  listboxId: string;
  activeIndex: number;
  onSelect: (href: string) => void;
}) {
  const flat = flatten(results);
  const householdCount = results.households.length;
  const entryCount = results.deathLedgerEntries.length;
  const plotCount = results.gravePlots.length;

  return (
    <ul className="py-1">
      {results.households.length > 0 && (
        <li
          className="px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          aria-hidden="true"
        >
          世帯
        </li>
      )}
      {results.households.map((h, i) => (
        <ResultRow
          key={h.id}
          id={`${listboxId}-opt-${i}`}
          active={activeIndex === i}
          onSelect={() => onSelect(flat[i]!.href)}
        >
          <span className="flex items-center gap-2 font-medium text-foreground">
            {h.householderName}
            {h.memoMatch && (
              <Badge variant="neutral" showIcon={false} className="text-xs">
                メモ・住所一致
              </Badge>
            )}
          </span>
          <span className="text-sm text-muted-foreground">{h.nameKana}</span>
          {h.phone && (
            <span className="text-sm text-muted-foreground">{h.phone}</span>
          )}
        </ResultRow>
      ))}

      {results.deathLedgerEntries.length > 0 && (
        <li
          className="px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          aria-hidden="true"
        >
          過去帳
        </li>
      )}
      {results.deathLedgerEntries.map((e, i) => {
        const flatIndex = householdCount + i;
        return (
          <ResultRow
            key={e.id}
            id={`${listboxId}-opt-${flatIndex}`}
            active={activeIndex === flatIndex}
            onSelect={() => onSelect(flat[flatIndex]!.href)}
          >
            <span className="font-medium text-foreground">
              {e.kaimyoName ?? e.secularName}
            </span>
            {e.kaimyoName && (
              <span className="text-sm text-muted-foreground">
                俗名: {e.secularName}
              </span>
            )}
          </ResultRow>
        );
      })}

      {results.gravePlots.length > 0 && (
        <li
          className="px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          aria-hidden="true"
        >
          区画
        </li>
      )}
      {results.gravePlots.map((g, i) => {
        const flatIndex = householdCount + entryCount + i;
        const sub = g.monumentName ?? g.householderName ?? g.inscription;
        return (
          <ResultRow
            key={g.id}
            id={`${listboxId}-opt-${flatIndex}`}
            active={activeIndex === flatIndex}
            onSelect={() => onSelect(flat[flatIndex]!.href)}
          >
            <span className="font-medium text-foreground">
              区画 {g.plotNumber}
            </span>
            {sub && (
              <span className="text-sm text-muted-foreground">{sub}</span>
            )}
          </ResultRow>
        );
      })}

      {results.noteHits.length > 0 && (
        <li
          className="px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          aria-hidden="true"
        >
          履歴・メモ
        </li>
      )}
      {results.noteHits.map((n, i) => {
        const flatIndex = householdCount + entryCount + plotCount + i;
        return (
          <ResultRow
            key={`${n.source}-${n.id}`}
            id={`${listboxId}-opt-${flatIndex}`}
            active={activeIndex === flatIndex}
            onSelect={() => onSelect(flat[flatIndex]!.href)}
          >
            <span className="flex items-center gap-2 font-medium text-foreground">
              {n.householderName}
              <Badge variant="neutral" showIcon={false} className="text-xs">
                {n.source === 'interaction' ? '対応履歴' : '備考メモ'}
              </Badge>
            </span>
            <span className="text-sm text-muted-foreground">{n.snippet}</span>
          </ResultRow>
        );
      })}
    </ul>
  );
}

function ResultRow({
  id,
  active,
  onSelect,
  children,
}: {
  id: string;
  active: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <li
      id={id}
      role="option"
      aria-selected={active}
      className={`flex cursor-pointer flex-col gap-0.5 px-4 py-2 ${
        active ? 'bg-muted' : 'hover:bg-muted'
      }`}
      // onClick だと外側 pointerdown で閉じる前に発火させたいので onPointerDown を使う
      onPointerDown={(e) => {
        e.preventDefault();
        onSelect();
      }}
    >
      {children}
    </li>
  );
}
