import Link from 'next/link';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
  getInitialAmountsForYear,
  getPostalTransferAccount,
  listActiveHouseholds,
  listActiveSubjects,
} from '@/features/postal-transfer/queries';
import { currentFiscalYear, formatYen } from '@/features/postal-transfer/format';
import { AMOUNT_SOURCE_LABELS } from '@/features/postal-transfer/types';
import {
  PostalTransferGenerator,
  type GeneratorSubject,
} from '@/features/postal-transfer/PostalTransferGenerator';
import {
  buildPostalSlip,
  payableSlips,
  resolveSubjectLines,
  type HouseholdSourceAmounts,
  type SubjectTemplate,
} from '@/lib/postal-transfer';

function parseYear(raw: string | undefined, fallback: number): number {
  if (!raw || !/^\d{4}$/.test(raw)) return fallback;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n) || n < 2000 || n > 2200) return fallback;
  return n;
}

export default async function FurikaePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const sp = await searchParams;
  const year = parseYear(sp.year, currentFiscalYear());

  const [account, subjectsRaw, households] = await Promise.all([
    getPostalTransferAccount(),
    listActiveSubjects(),
    listActiveHouseholds(),
  ]);

  const subjectTemplates: SubjectTemplate[] = subjectsRaw.map((s) => ({
    id: s.id,
    name: s.name,
    defaultAmount: s.defaultAmount,
    isVisible: s.isVisible,
    amountSource: s.amountSource,
  }));

  const initialAmounts = await getInitialAmountsForYear(year);

  const slips = payableSlips(
    households.map((h) => {
      const sourceAmounts: HouseholdSourceAmounts =
        initialAmounts.get(h.id) ?? {};
      const lines = resolveSubjectLines(subjectTemplates, sourceAmounts);
      return buildPostalSlip({
        householdId: h.id,
        householderName: h.householderName,
        postalCode: h.postalCode,
        address: h.address,
        lines,
      });
    }),
  );

  const generatorSubjects: GeneratorSubject[] = subjectsRaw
    .filter((s) => s.isVisible)
    .map((s) => ({
      id: s.id,
      name: s.name,
      amountSourceLabel: AMOUNT_SOURCE_LABELS[s.amountSource],
    }));

  const hasAccount = Boolean(
    account?.postalAccountName &&
      account?.postalAccountSymbol &&
      account?.postalAccountNumber,
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="郵便振替（払込取扱票）"
        description="科目を設定し、施主の氏名・住所と金額を差し込んで振替用紙を印刷します。"
        breadcrumbs={[
          { label: 'ダッシュボード', href: '/dashboard' },
          { label: '郵便振替' },
        ]}
        actions={
          <Link href="/furikae/settings">
            <Button variant="secondary">設定（科目・口座）</Button>
          </Link>
        }
      />

      {subjectsRaw.length === 0 ? (
        <EmptyState
          title="まだ科目が登録されていません"
          description="護持会費・墓地管理費・お布施 等の科目を設定すると、世帯ごとに金額を差し込んで振替用紙を作成できます。"
          action={
            <Link href="/furikae/settings">
              <Button>科目を設定する</Button>
            </Link>
          }
        />
      ) : (
        <>
          {/* ステップ 1: 科目の確認 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground">
                  1
                </span>
                科目の確認
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-2 sm:grid-cols-2">
                {subjectsRaw.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2"
                  >
                    <span className="text-foreground">
                      {s.name}
                      {!s.isVisible && (
                        <Badge variant="neutral" className="ml-2">
                          非表示
                        </Badge>
                      )}
                    </span>
                    <span className="text-right">
                      <span className="block text-foreground">
                        {formatYen(s.defaultAmount)}
                      </span>
                      {s.amountSource !== 'NONE' && (
                        <span className="block text-xs text-muted-foreground">
                          {AMOUNT_SOURCE_LABELS[s.amountSource]}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* ステップ 2: 一括生成 */}
          <PostalTransferGenerator
            fiscalYear={year}
            payableCount={slips.length}
            subjects={generatorSubjects}
            hasAccount={hasAccount}
          />

          {/* 世帯一覧 (単票生成への導線) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                世帯ごとの作成（{slips.length} 世帯）
              </CardTitle>
            </CardHeader>
            <CardContent>
              {slips.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  金額のある対象世帯がありません。科目の金額や当年度の請求をご確認ください。
                </p>
              ) : (
                <>
                  {/* PC: テーブル */}
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>施主</TableHead>
                          <TableHead>住所</TableHead>
                          <TableHead className="text-right">合計</TableHead>
                          <TableHead className="text-right">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {slips.map((s) => (
                          <TableRow key={s.householdId}>
                            <TableCell>
                              <Link
                                href={`/danshintoto/${s.householdId}`}
                                className="text-info hover:underline"
                              >
                                {s.householderName} 様
                              </Link>
                            </TableCell>
                            <TableCell>
                              {s.address ? (
                                <span>
                                  {s.postalCode && (
                                    <span className="text-sm text-muted-foreground">
                                      〒{s.postalCode}{' '}
                                    </span>
                                  )}
                                  {s.address}
                                </span>
                              ) : (
                                <Badge variant="warning">住所未登録</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatYen(s.total)}
                            </TableCell>
                            <TableCell className="text-right">
                              <a
                                href={`/api/furikae/pdf?year=${year}&householdId=${s.householdId}&detail=1`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Button variant="secondary" size="sm">
                                  単票出力
                                </Button>
                              </a>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* スマホ: カード */}
                  <ul className="space-y-2 md:hidden">
                    {slips.map((s) => (
                      <li
                        key={s.householdId}
                        className="rounded-lg border border-border bg-surface p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <Link
                            href={`/danshintoto/${s.householdId}`}
                            className="font-medium text-foreground hover:underline"
                          >
                            {s.householderName} 様
                          </Link>
                          <span className="text-foreground">
                            {formatYen(s.total)}
                          </span>
                        </div>
                        <div className="mt-1 text-sm">
                          {s.address ? (
                            <span className="text-muted-foreground">
                              {s.postalCode && `〒${s.postalCode} `}
                              {s.address}
                            </span>
                          ) : (
                            <Badge variant="warning">住所未登録</Badge>
                          )}
                        </div>
                        <div className="mt-2">
                          <a
                            href={`/api/furikae/pdf?year=${year}&householdId=${s.householdId}&detail=1`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button variant="secondary" size="sm">
                              単票出力
                            </Button>
                          </a>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
