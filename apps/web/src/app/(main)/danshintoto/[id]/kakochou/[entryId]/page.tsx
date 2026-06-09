import Link from 'next/link';
import { notFound } from 'next/navigation';
import { allAnniversariesOf, KAIKI_NAMES, type Anniversary } from '@/lib/nenki';
import { chuinScheduleOf, type ChuinDay } from '@/lib/chuin';
import { formatDeathDateSeireki } from '@/lib/kakochou';
import {
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import { getHouseholdById } from '@/features/danshintoto/queries';
import { getDeathLedgerEntryById } from '@/features/kakochou/queries';
import { getCurrentTenantSectDefaultCutoff } from '@/features/nenki/sect-cutoff';
import { SoftDeleteEntryButton } from '@/features/kakochou/SoftDeleteEntryButton';
import { can, getCurrentRole } from '@/lib/auth';
import { DocumentSection } from '@/features/documents/DocumentSection';
import { listDocumentsByDeathLedgerEntry } from '@/features/documents/queries';

type AnniversaryStatus = 'past' | 'current' | 'future';

function statusOf(year: number, currentYear: number): AnniversaryStatus {
  if (year < currentYear) return 'past';
  if (year === currentYear) return 'current';
  return 'future';
}

function statusLabel(status: AnniversaryStatus): string {
  switch (status) {
    case 'past':
      return '済';
    case 'current':
      return '今年';
    case 'future':
      return '未来';
  }
}

function statusClass(status: AnniversaryStatus): string {
  switch (status) {
    case 'past':
      return 'bg-muted text-muted-foreground';
    case 'current':
      return 'bg-brand-soft text-brand-soft-foreground font-medium';
    case 'future':
      return 'bg-surface text-foreground';
  }
}

function formatSchedule(
  month: number | null,
  day: number | null,
): string {
  if (month === null || day === null) return '月日不明';
  return `${month}月${day}日`;
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">
        {value && value.length > 0 ? (
          value
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </dd>
    </>
  );
}

export default async function DeathLedgerEntryDetailPage({
  params,
}: {
  params: Promise<{ id: string; entryId: string }>;
}) {
  const { id, entryId } = await params;
  const [household, entry] = await Promise.all([
    getHouseholdById(id),
    getDeathLedgerEntryById(entryId),
  ]);

  if (!household || !entry) {
    notFound();
  }
  if (entry.person.householdId !== household.id) {
    notFound();
  }

  const [documents, role] = await Promise.all([
    listDocumentsByDeathLedgerEntry(entry.id),
    getCurrentRole(),
  ]);
  const canEditDocs = role !== null && can(role, 'create');
  const canDeleteDocs = role !== null && can(role, 'destructive');

  const deathDate = {
    year: entry.deathYear,
    month: entry.deathMonth,
    day: entry.deathDay,
  };
  const deathDateLabel = formatDeathDateSeireki({
    precision: entry.datePrecision,
    year: entry.deathYear,
    month: entry.deathMonth,
    day: entry.deathDay,
  });

  // 実効 cutoff: per-entry の設定が常に優先。未設定なら宗派既定にフォールバックする。
  // sect=null/曹洞宗等では宗派既定が null となり従来挙動と完全一致する (後方互換)。
  const sectDefaultCutoff = await getCurrentTenantSectDefaultCutoff();
  const cutoff = entry.memorialCutoffAnniversary ?? sectDefaultCutoff;
  // 年が判明している場合のみ年忌を計算できる。年不明 (UNKNOWN) は計算対象外。
  const anniversaries: Anniversary[] =
    deathDate.year !== null
      ? allAnniversariesOf(
          { year: deathDate.year, month: deathDate.month, day: deathDate.day },
          cutoff,
        )
      : [];
  const currentYear = new Date().getFullYear();
  const cutoffLabel =
    cutoff !== null && (cutoff === 33 || cutoff === 50)
      ? KAIKI_NAMES[cutoff]
      : null;
  // この実効 cutoff が「故人ごとの設定」ではなく「宗派の既定」由来かを区別する
  // (UI 上で出所が分かるよう注記する。設定画面の『故人ごとの設定が優先』と整合)。
  const cutoffFromSect =
    entry.memorialCutoffAnniversary === null && sectDefaultCutoff !== null;

  // 中陰 (忌日) は命日 (年月日すべて判明) が前提。精度不足なら算出しない。
  const chuinSchedule: ChuinDay[] =
    entry.datePrecision === 'FULL' &&
    deathDate.year !== null &&
    deathDate.month !== null &&
    deathDate.day !== null
      ? chuinScheduleOf({
          year: deathDate.year,
          month: deathDate.month,
          day: deathDate.day,
        })
      : [];

  return (
    <div className="space-y-6">
      <div>
        <nav className="text-sm text-muted-foreground">
          <Link href="/danshintoto" className="hover:underline">
            檀信徒カルテ
          </Link>
          <span className="mx-2">/</span>
          <Link
            href={`/danshintoto/${household.id}`}
            className="hover:underline"
          >
            {household.householderName}
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">{entry.secularName}</span>
        </nav>
        <div className="mt-2 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-rounded tracking-wider">
              {entry.secularName}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {entry.person.nameKana}
              {entry.person.familyRelation && (
                <span className="ml-2 text-muted-foreground">
                  ({entry.person.familyRelation})
                </span>
              )}
            </p>
          </div>
          <Link
            href={`/danshintoto/${household.id}/kakochou/${entry.id}/edit`}
            className="rounded border border-border px-4 py-2 text-sm text-foreground hover:bg-muted"
          >
            編集
          </Link>
        </div>
      </div>

      <div className="rounded border border-border bg-surface p-6">
        <h2 className="text-lg font-medium">基本情報</h2>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3">
          <DetailRow label="戒名" value={entry.kaimyoName} />
          <DetailRow label="命日 (西暦)" value={deathDateLabel} />
          <DetailRow label="命日 (和暦)" value={entry.dateOfDeathWareki} />
          <DetailRow
            label="行年"
            value={entry.ageAtDeath !== null ? `${entry.ageAtDeath} 歳` : null}
          />
          <DetailRow label="埋葬場所" value={entry.burialLocation} />
          <DetailRow
            label="弔い上げ回忌"
            value={
              cutoffLabel
                ? `${cutoffLabel}で弔い上げ${cutoffFromSect ? '（宗派既定）' : ''}`
                : '未設定（五十回忌まで）'
            }
          />
        </dl>
      </div>

      <div className="rounded border border-border bg-surface p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium">年忌予定</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              命日を起点に一周忌〜
              {cutoffLabel ?? '五十回忌'}までを自動計算しています。
              {cutoffLabel
                ? `${cutoffLabel}で弔い上げのため、以降の年忌はご案内の対象外です。`
                : '2/29 命日で平年の場合は 3/1 に補正されます。'}
            </p>
          </div>
        </div>
        <div className="mt-5 overflow-hidden rounded border border-border">
          <table className="w-full divide-y divide-border text-sm">
            <thead className="bg-brand text-left text-xs uppercase tracking-wider text-brand-foreground">
              <tr>
                <th className="px-4 py-2">回忌</th>
                <th className="px-4 py-2">予定年</th>
                <th className="px-4 py-2">予定日</th>
                <th className="px-4 py-2">状態</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {anniversaries.map((a) => {
                const status = statusOf(a.year, currentYear);
                return (
                  <tr key={a.kaiki} className={statusClass(status)}>
                    <td className="px-4 py-2 font-medium">{a.name}</td>
                    <td className="px-4 py-2">{a.year}</td>
                    <td className="px-4 py-2">
                      {formatSchedule(a.month, a.day)}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {statusLabel(status)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg">中陰（忌日）</CardTitle>
            <CardDescription className="mt-1">
              命日を一日目と数え、初七日〜四十九日（満中陰）と百ヶ日（卒哭忌）を自動計算しています。西暦・和暦を併記しています。
            </CardDescription>
          </div>
          {chuinSchedule.length > 0 && (
            <a
              href={`/api/chuin/pdf?entryId=${entry.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'shrink-0')}
            >
              中陰表 PDF
            </a>
          )}
        </CardHeader>
        <CardContent>
          {chuinSchedule.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              中陰表の作成には命日（年月日）が必要です。命日を入力すると自動計算されます。
            </p>
          ) : (
            <>
              {/* PC: テーブル / スマホ: カード で出し分け */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>忌日</TableHead>
                      <TableHead>当日</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {chuinSchedule.map((c) => (
                      <TableRow key={c.key}>
                        <TableCell className="font-medium">
                          {c.name}
                          {c.altName && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              （{c.altName}）
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {c.year}年{c.month}月{c.day}日
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <ul className="space-y-2 sm:hidden">
                {chuinSchedule.map((c) => (
                  <li
                    key={c.key}
                    className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3"
                  >
                    <span className="font-medium text-foreground">
                      {c.name}
                      {c.altName && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          （{c.altName}）
                        </span>
                      )}
                    </span>
                    <span className="text-foreground">
                      {c.year}年{c.month}月{c.day}日
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      <div className="rounded border border-border bg-surface p-6">
        <h2 className="text-lg font-medium">備考</h2>
        <div className="mt-3 whitespace-pre-wrap text-sm text-foreground">
          {entry.memo && entry.memo.length > 0 ? (
            entry.memo
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </div>
      </div>

      <DocumentSection
        target={{ kind: 'deathLedgerEntry', id: entry.id }}
        documents={documents}
        canEdit={canEditDocs}
        canDelete={canDeleteDocs}
      />

      <div className="rounded border border-red-200 bg-red-50 p-6">
        <h2 className="text-base font-medium text-red-900">
          過去帳一覧からの除外
        </h2>
        <p className="mt-2 text-sm text-red-800">
          誤登録や重複の修正目的で、このエントリを一覧から除外します。
          <br />
          物理削除は行いません (データと履歴は保持されます)。除外後は
          <Link href="/kakochou/jogai" className="underline">
            除外済みの過去帳
          </Link>
          からいつでも復元できます。
        </p>
        <div className="mt-4">
          <SoftDeleteEntryButton
            entryId={entry.id}
            secularName={entry.secularName}
          />
        </div>
      </div>
    </div>
  );
}
