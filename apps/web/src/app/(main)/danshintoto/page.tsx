import Link from 'next/link';
import { isValidUuid } from '@/lib/db';
import {
  buttonVariants,
  Card,
  CardContent,
  EmptyState,
  PageHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import {
  listHouseholdsWithTags,
  listTags,
} from '@/features/tags/queries';
import { HouseholdTagFilter } from '@/features/tags/HouseholdTagFilter';
import { cn } from '@/lib/utils';
import {
  normalizeTagColor,
  TAG_COLOR_CHIP_CLASS,
} from '@/features/tags/tag-colors';

function formatJaDate(d: Date): string {
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

export default async function DanshintoListPage({
  searchParams,
}: {
  searchParams: Promise<{ tags?: string; mode?: string }>;
}) {
  const sp = await searchParams;
  const selectedTagIds = (sp.tags ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => isValidUuid(s));
  const mode: 'and' | 'or' = sp.mode === 'and' ? 'and' : 'or';

  const [households, allTags] = await Promise.all([
    listHouseholdsWithTags({ tagIds: selectedTagIds, mode }),
    listTags(),
  ]);

  const isFiltering = selectedTagIds.length > 0;

  return (
    <div className="space-y-4">
      <PageHeader
        title="檀信徒カルテ"
        description="登録世帯の一覧です。"
        actions={
          <div className="flex gap-2">
            <Link
              href="/danshintoto/new/kantan"
              className={buttonVariants({ variant: 'secondary' })}
            >
              かんたん登録
            </Link>
            <Link
              href="/danshintoto/new"
              className={buttonVariants({ variant: 'primary' })}
            >
              ＋ 新規登録
            </Link>
          </div>
        }
      />

      <HouseholdTagFilter
        allTags={allTags}
        selectedTagIds={selectedTagIds}
        mode={mode}
      />

      {households.length === 0 ? (
        <EmptyState
          title={
            isFiltering
              ? '選択したタグに該当する世帯はありませんでした'
              : 'まだ世帯が登録されていません'
          }
          description={
            isFiltering
              ? '絞り込み条件を変更するか、解除してお試しください。'
              : '右上の「＋ 新規登録」から最初の世帯を登録してください。'
          }
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {households.length} 件
            {isFiltering && '（タグで絞り込み中）'}
          </p>

          {/* PC: テーブル表示 */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>施主名</TableHead>
                  <TableHead>ふりがな</TableHead>
                  <TableHead>電話</TableHead>
                  <TableHead>タグ</TableHead>
                  <TableHead>登録日</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {households.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/danshintoto/${h.id}`}
                        className="text-foreground hover:underline"
                      >
                        {h.householderName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {h.nameKana}
                    </TableCell>
                    <TableCell>{h.phone ?? h.mobile ?? '—'}</TableCell>
                    <TableCell>
                      {h.tags.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {h.tags.map((t) => (
                            <span
                              key={t.id}
                              className={cn(
                                'inline-flex items-center rounded-full border px-2 py-0.5 text-xs',
                                TAG_COLOR_CHIP_CLASS[normalizeTagColor(t.color)],
                              )}
                            >
                              {t.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatJaDate(h.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* スマホ/タブレット: カード表示 */}
          <ul className="space-y-3 md:hidden">
            {households.map((h) => (
              <li key={h.id}>
                <Card>
                  <CardContent className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Link
                          href={`/danshintoto/${h.id}`}
                          className="text-lg font-medium text-foreground hover:underline"
                        >
                          {h.householderName}
                        </Link>
                        <div className="text-sm text-muted-foreground">
                          {h.nameKana}
                        </div>
                      </div>
                      <span className="shrink-0 text-sm text-muted-foreground">
                        {formatJaDate(h.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-foreground">
                      {h.phone ?? h.mobile ?? '電話未登録'}
                    </p>
                    {h.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {h.tags.map((t) => (
                          <span
                            key={t.id}
                            className={cn(
                              'inline-flex items-center rounded-full border px-2 py-0.5 text-xs',
                              TAG_COLOR_CHIP_CLASS[normalizeTagColor(t.color)],
                            )}
                          >
                            {t.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="text-xs text-muted-foreground">
        ※ 一覧は最大 100 件です。詳細画面・検索・ページングは次回以降で実装します。
      </p>
    </div>
  );
}
