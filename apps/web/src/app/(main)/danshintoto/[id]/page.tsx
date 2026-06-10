import { Fragment } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { setHouseholdInactiveAction } from '@/features/danshintoto/actions';
import { getHouseholdById } from '@/features/danshintoto/queries';
import { listDeathLedgerEntriesByHousehold } from '@/features/kakochou/queries';
import { NenkiBadges } from '@/features/kakochou/NenkiBadges';
import { getCurrentTenantSectDefaultCutoff } from '@/features/nenki/sect-cutoff';
import { formatDeathDateSeireki } from '@/lib/kakochou';
import { listMemorialServicesByHousehold } from '@/features/houyou/queries';
import { PREPARATION_STATUS_LABELS } from '@/features/houyou/types';
import { listLivingMembersByHousehold } from '@/features/kazoku/queries';
import { listGravePlotsByHousehold } from '@/features/kukaku/queries';
import { listBurialsByHousehold } from '@/features/kukaku/burial-queries';
import { GravePlotStatusBadge } from '@/features/kukaku/StatusBadge';
import { GRAVE_PLOT_TYPE_LABELS } from '@/features/kukaku/types';
import { listTransactionsByHousehold } from '@/features/kaikei/queries';
import {
  TRANSACTION_CATEGORY_LABELS,
  TRANSACTION_DIRECTION_LABELS,
} from '@/features/kaikei/types';
import {
  getFeePlanByHousehold,
  listInvoicesByHousehold,
} from '@/features/gojikai/queries';
import { formatYen as formatGojikaiYen } from '@/features/gojikai/format';
import {
  INVOICE_STATUS_LABELS,
  MAINTENANCE_FEE_METHOD_LABELS,
} from '@/lib/gojikai';
import { listInteractionNotesByHousehold } from '@/features/danshintoto/interaction-queries';
import {
  InteractionTimeline,
  type TimelineNote,
} from '@/features/danshintoto/InteractionTimeline';
import { buildHouseholdTimeline } from '@/features/danshintoto/merged-timeline-queries';
import { MergedTimeline } from '@/features/danshintoto/MergedTimeline';
import { HouseholdActionBar } from '@/features/danshintoto/HouseholdActionBar';
import {
  listHouseholdTags,
  listTags,
} from '@/features/tags/queries';
import { HouseholdTagEditor } from '@/features/tags/HouseholdTagEditor';
import { listContactPointsByHousehold } from '@/features/danshintoto/contact-point-queries';
import { ContactPointEditor } from '@/features/danshintoto/ContactPointEditor';
import { listSuccessionsByHousehold } from '@/features/danshintoto/succession-queries';
import { SuccessionSection } from '@/features/danshintoto/SuccessionSection';
import { can, requireCapability } from '@/lib/auth';
import { withTenant } from '@/lib/db';
import { DocumentSection } from '@/features/documents/DocumentSection';
import { listDocumentsByHousehold } from '@/features/documents/queries';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';

function formatJaDate(d: Date): string {
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
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
        {value && value.length > 0 ? value : <span className="text-muted-foreground">—</span>}
      </dd>
    </>
  );
}

const TAB_VALUES = [
  'overview',
  'interactions',
  'timeline',
  'family',
  'houyou',
  'kaikei',
  'kukaku',
  'documents',
] as const;
type TabValue = (typeof TAB_VALUES)[number];

function resolveTab(raw: string | string[] | undefined): TabValue {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return TAB_VALUES.includes(v as TabValue) ? (v as TabValue) : 'overview';
}

export default async function HouseholdDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const activeTab = resolveTab(sp.tab);

  // 接続プール枯渇 (問題A) 根治: カルテ詳細の全クエリを単一 withTenant トランザクションに
  // 集約し、コネクション占有を 1 本に抑える (Supabase pooler 上限 15 に対する同時アクセス耐性)。
  // 各クエリ関数は tx を渡して同一トランザクションに相乗りする (withTenantOrTx)。認可はここで
  // requireCapability('read') を 1 回だけ行い、tx 経路の各クエリは認可を重複させない。
  // Prisma 対話 tx は単一コネクション上で直列実行されるため、Promise.all でも実質順次となる。
  const user = await requireCapability('read');
  const snapshot = await withTenant(user.tenantId, async (tx) => {
    const household = await getHouseholdById(id, tx);
    if (!household) return null;
    const [
      deathLedgerEntries,
      memorialServices,
      familyMembers,
      gravePlots,
      householdBurials,
      transactions,
      interactionNotes,
      feePlan,
      feeInvoices,
      assignedTags,
      allTags,
      contactPoints,
      successions,
      documents,
      timelineItems,
      sectDefaultCutoff,
    ] = await Promise.all([
      listDeathLedgerEntriesByHousehold(household.id, tx),
      listMemorialServicesByHousehold(household.id, tx),
      listLivingMembersByHousehold(household.id, tx),
      listGravePlotsByHousehold(household.id, tx),
      listBurialsByHousehold(household.id, tx),
      listTransactionsByHousehold(household.id, tx),
      listInteractionNotesByHousehold(household.id, tx),
      getFeePlanByHousehold(household.id, tx),
      listInvoicesByHousehold(household.id, tx),
      listHouseholdTags(household.id, tx),
      listTags(tx),
      listContactPointsByHousehold(household.id, tx),
      listSuccessionsByHousehold(household.id, tx),
      listDocumentsByHousehold(household.id, tx),
      buildHouseholdTimeline(household.id, tx),
      getCurrentTenantSectDefaultCutoff(tx),
    ]);
    return {
      household,
      deathLedgerEntries,
      memorialServices,
      familyMembers,
      gravePlots,
      householdBurials,
      transactions,
      interactionNotes,
      feePlan,
      feeInvoices,
      assignedTags,
      allTags,
      contactPoints,
      successions,
      documents,
      timelineItems,
      sectDefaultCutoff,
    };
  });

  if (!snapshot) {
    notFound();
  }
  const {
    household,
    deathLedgerEntries,
    memorialServices,
    familyMembers,
    gravePlots,
    householdBurials,
    transactions,
    interactionNotes,
    feePlan,
    feeInvoices,
    assignedTags,
    allTags,
    contactPoints,
    successions,
    documents,
    timelineItems,
    sectDefaultCutoff,
  } = snapshot;

  // UI 補助: 役割で操作ボタンの出し分けをする (サーバ側 requireCapability が本丸)。
  const role = user.role;
  const canManageSuccession = role !== null && can(role, 'destructive');
  const canCreateSuccession = role !== null && can(role, 'create');
  const canEditDocs = role !== null && can(role, 'create');
  const canDeleteDocs = role !== null && can(role, 'destructive');

  const timelineNotes: TimelineNote[] = interactionNotes.map((n) => ({
    id: n.id,
    kind: n.kind,
    category: n.category,
    isPinned: n.isPinned,
    content: n.content,
    occurredAt: n.occurredAt.toISOString(),
    authorName: n.authorName,
  }));

  // 新規記録フォームの日時プリセット (現在の JST 日時を datetime-local 形式で)。
  const now = new Date();
  const defaultOccurredAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  return (
    <div className="space-y-5 pb-24 md:pb-20">
      <div>
        <nav className="text-sm text-muted-foreground">
          <Link href="/danshintoto" className="hover:underline">
            檀信徒カルテ
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">{household.householderName}</span>
        </nav>
        <div className="mt-2 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-rounded tracking-wider">
              {household.householderName}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {household.nameKana}
            </p>
          </div>
          <Link
            href={`/danshintoto/${household.id}/edit`}
            className="rounded border border-border px-4 py-2 text-sm text-foreground hover:bg-muted"
          >
            編集
          </Link>
        </div>
      </div>

      <Tabs defaultValue={activeTab} paramKey="tab" className="space-y-5">
        <TabsList aria-label="檀信徒カルテのセクション">
          <TabsTrigger value="overview">概要</TabsTrigger>
          <TabsTrigger value="interactions">対応履歴</TabsTrigger>
          <TabsTrigger value="timeline">年表</TabsTrigger>
          <TabsTrigger value="family">家族・過去帳</TabsTrigger>
          <TabsTrigger value="houyou">法要</TabsTrigger>
          <TabsTrigger value="kaikei">会計</TabsTrigger>
          <TabsTrigger value="kukaku">区画</TabsTrigger>
          <TabsTrigger value="documents">書類</TabsTrigger>
        </TabsList>

        {/* ===== 概要 ===== */}
        <TabsContent value="overview" className="space-y-5">
          <div className="rounded border border-border bg-surface p-6">
            <h2 className="text-lg font-medium">連絡先</h2>
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3">
              <DetailRow label="電話" value={household.phone} />
              <DetailRow label="携帯電話" value={household.mobile} />
              <DetailRow label="メール" value={household.email} />
              <DetailRow label="郵便番号" value={household.postalCode} />
              <DetailRow label="住所" value={household.address} />
            </dl>
          </div>

          <div className="rounded border border-border bg-surface p-6">
            <div className="mb-4">
              <h2 className="text-lg font-medium">連絡先（第2連絡先・ご親族など）</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                第 2 連絡先・ご親族・成年後見人などを、人数の制限なくご登録いただけます。
                並べ替えや、ご家族構成員との紐付けもできます。
              </p>
            </div>
            <ContactPointEditor
              householdId={household.id}
              contactPoints={contactPoints.map((c) => ({
                id: c.id,
                personId: c.personId,
                relationLabel: c.relationLabel,
                name: c.name,
                phone: c.phone,
                mobile: c.mobile,
                email: c.email,
                postalCode: c.postalCode,
                address: c.address,
                note: c.note,
                isPrimary: c.isPrimary,
              }))}
              familyMembers={familyMembers.map((m) => ({
                id: m.id,
                name: m.name,
                familyRelation: m.familyRelation,
              }))}
            />
          </div>

          <div className="rounded border border-border bg-surface p-6">
            <div className="mb-4">
              <h2 className="text-lg font-medium">タグ</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                気づきや申し送り事項をタグで残し、一覧から横断的に絞り込めます。
              </p>
            </div>
            <HouseholdTagEditor
              householdId={household.id}
              assignedTags={assignedTags.map((t) => ({
                id: t.id,
                name: t.name,
                color: t.color,
              }))}
              allTags={allTags.map((t) => ({
                id: t.id,
                name: t.name,
                color: t.color,
              }))}
            />
          </div>

          <div className="rounded border border-border bg-surface p-6">
            <h2 className="text-lg font-medium">備考</h2>
            <div className="mt-3 whitespace-pre-wrap text-sm text-foreground">
              {household.memo && household.memo.length > 0 ? (
                household.memo
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </div>
          </div>

          <div className="rounded border border-border bg-surface p-6">
            <div className="mb-4">
              <h2 className="text-lg font-medium">承継履歴</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                施主の交代（お亡くなり・代替わり等）を記録します。お亡くなりの登録時には
                承継候補が自動で起票されます。実際の施主確定はご担当者の承認操作で行います。
              </p>
            </div>
            <SuccessionSection
              householdId={household.id}
              canManage={canManageSuccession}
              canCreate={canCreateSuccession}
              successions={successions.map((s) => ({
                id: s.id,
                reason: s.reason,
                status: s.status,
                previousHouseholderName: s.previousHouseholderName,
                nextHouseholderName: s.nextHouseholderName,
                occurredAt: s.occurredAt
                  ? s.occurredAt.toISOString()
                  : null,
                note: s.note,
              }))}
            />
          </div>

          <div className="rounded border border-border bg-surface p-6 text-sm text-muted-foreground">
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
              <dt>登録日</dt>
              <dd>{formatJaDate(household.createdAt)}</dd>
              <dt>最終更新</dt>
              <dd>{formatJaDate(household.updatedAt)}</dd>
              <dt>世帯 ID</dt>
              <dd className="font-mono text-xs">{household.id}</dd>
            </dl>
          </div>

          <div className="rounded border border-red-200 bg-red-50 p-6">
            <h2 className="text-base font-medium text-red-900">離檀処理</h2>
            <p className="mt-2 text-sm text-red-800">
              この世帯を一覧から外します。データは保持され、過去帳・年忌等の記録は残ります。
            </p>
            <form action={setHouseholdInactiveAction} className="mt-4">
              <input type="hidden" name="id" value={household.id} />
              <button
                type="submit"
                className="rounded border border-red-300 bg-surface px-4 py-2 text-sm text-red-800 hover:bg-red-100"
              >
                離檀として記録する
              </button>
            </form>
          </div>
        </TabsContent>

        {/* ===== 対応履歴 ===== */}
        <TabsContent value="interactions">
          <div
            id="interaction-history"
            className="scroll-mt-20 rounded border border-border bg-surface p-6"
          >
            <div className="mb-4">
              <h2 className="text-lg font-medium">対応履歴</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {timelineNotes.length === 0
                  ? 'お電話・ご訪問・お話の記録を時系列で残せます。'
                  : `${timelineNotes.length} 件の記録 (新しい順)`}
              </p>
            </div>
            <InteractionTimeline
              householdId={household.id}
              notes={timelineNotes}
              defaultOccurredAt={defaultOccurredAt}
            />
          </div>
        </TabsContent>

        {/* ===== 年表 (対応履歴 + 法要のマージ・閲覧専用) ===== */}
        <TabsContent value="timeline">
          <div className="rounded border border-border bg-surface p-6">
            <div className="mb-4">
              <h2 className="text-lg font-medium">年表</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                対応履歴と法要を時系列でまとめた一覧です（新しい順・閲覧専用）。
              </p>
            </div>
            <MergedTimeline items={timelineItems} />
          </div>
        </TabsContent>

        {/* ===== 家族・過去帳 ===== */}
        <TabsContent value="family" className="space-y-5">
          <div className="rounded border border-border bg-surface p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-medium">家族構成員</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {familyMembers.length === 0
                    ? 'この世帯の家族構成員はまだ登録されていません。'
                    : `登録件数: ${familyMembers.length} 名 (生存者のみ表示)`}
                </p>
              </div>
              <Link
                href={`/danshintoto/${household.id}/kazoku/new`}
                className="inline-flex min-h-touch items-center rounded bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-hover"
              >
                + 家族を追加
              </Link>
            </div>

            {familyMembers.length > 0 && (
              <div className="mt-5 overflow-hidden rounded border border-border">
                <table className="w-full divide-y divide-border text-sm">
                  <thead className="bg-brand text-left text-xs uppercase tracking-wider text-brand-foreground">
                    <tr>
                      <th className="px-4 py-2">続柄</th>
                      <th className="px-4 py-2">氏名</th>
                      <th className="px-4 py-2">ふりがな</th>
                      <th className="px-4 py-2">生年月日</th>
                      <th className="px-4 py-2 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {familyMembers.map((p) => (
                      <tr key={p.id} className="hover:bg-muted">
                        <td className="px-4 py-2 text-foreground">
                          {p.familyRelation ?? (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2 font-medium text-foreground">
                          {p.name}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">{p.nameKana}</td>
                        <td className="px-4 py-2 text-foreground">
                          {p.birthDate
                            ? `${p.birthDate.getUTCFullYear()}/${p.birthDate.getUTCMonth() + 1}/${p.birthDate.getUTCDate()}`
                            : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <Link
                            href={`/danshintoto/${household.id}/kazoku/${p.id}/edit`}
                            className="inline-block rounded border border-border px-3 py-1 text-xs text-foreground hover:bg-muted"
                          >
                            編集
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded border border-border bg-surface p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-medium">過去帳</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {deathLedgerEntries.length === 0
                    ? 'この世帯の過去帳エントリはまだ登録されていません。'
                    : `登録件数: ${deathLedgerEntries.length} 件`}
                </p>
              </div>
              <Link
                href={`/danshintoto/${household.id}/kakochou/new`}
                className="inline-flex min-h-touch items-center rounded bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-hover"
              >
                + 過去帳に登録
              </Link>
            </div>

            {deathLedgerEntries.length > 0 && (
              <div className="mt-5 overflow-hidden rounded border border-border">
                <table className="w-full divide-y divide-border text-sm">
                  <thead className="bg-brand text-left text-xs uppercase tracking-wider text-brand-foreground">
                    <tr>
                      <th className="px-4 py-2">俗名</th>
                      <th className="px-4 py-2">戒名</th>
                      <th className="px-4 py-2">没年月日</th>
                      <th className="px-4 py-2">行年</th>
                      <th className="px-4 py-2">続柄</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {deathLedgerEntries.map((e) => (
                      <Fragment key={e.id}>
                        <tr className="hover:bg-muted">
                          <td className="px-4 py-2 font-medium text-foreground">
                            <Link
                              href={`/danshintoto/${household.id}/kakochou/${e.id}`}
                              className="hover:underline"
                            >
                              {e.secularName}
                            </Link>
                          </td>
                          <td className="px-4 py-2 text-foreground">
                            {e.kaimyoName ?? (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-foreground">
                            {e.dateOfDeathWareki ??
                              formatDeathDateSeireki({
                                precision: e.datePrecision,
                                year: e.deathYear,
                                month: e.deathMonth,
                                day: e.deathDay,
                              })}
                          </td>
                          <td className="px-4 py-2 text-foreground">
                            {e.ageAtDeath ?? (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-foreground">
                            {e.person.familyRelation ?? (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                        {e.deathYear !== null && (
                          <tr className="bg-muted/40">
                            <td colSpan={5} className="px-4 pb-3 pt-0">
                              <NenkiBadges
                                deathYear={e.deathYear}
                                deathMonth={e.deathMonth}
                                deathDay={e.deathDay}
                                cutoff={
                                  e.memorialCutoffAnniversary ??
                                  sectDefaultCutoff
                                }
                                layout="scroll"
                              />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ===== 法要 ===== */}
        <TabsContent value="houyou">
          <div className="rounded border border-border bg-surface p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-medium">法要</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {memorialServices.length === 0
                    ? 'この世帯の法要予定はまだ登録されていません。'
                    : `登録件数: ${memorialServices.length} 件 (過去・中止も含む)`}
                </p>
              </div>
              <Link
                href={`/houyou/new?householdId=${household.id}`}
                className="inline-flex min-h-touch items-center rounded bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-hover"
              >
                + 法要を登録
              </Link>
            </div>

            {memorialServices.length > 0 && (
              <div className="mt-5 overflow-hidden rounded border border-border">
                <table className="w-full divide-y divide-border text-sm">
                  <thead className="bg-brand text-left text-xs uppercase tracking-wider text-brand-foreground">
                    <tr>
                      <th className="px-4 py-2">予定日時</th>
                      <th className="px-4 py-2">法要名</th>
                      <th className="px-4 py-2">場所</th>
                      <th className="px-4 py-2">状況</th>
                      <th className="px-4 py-2 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {memorialServices.map((s) => {
                      const dt = s.scheduledAt;
                      const formatted = `${dt.getFullYear()}/${dt.getMonth() + 1}/${dt.getDate()} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
                      return (
                        <tr key={s.id} className="hover:bg-muted">
                          <td className="px-4 py-2 text-foreground">{formatted}</td>
                          <td className="px-4 py-2 font-medium text-foreground">
                            <Link
                              href={`/houyou/${s.id}`}
                              className="text-foreground underline decoration-border underline-offset-2 hover:decoration-brand"
                            >
                              {s.serviceName}
                            </Link>
                          </td>
                          <td className="px-4 py-2 text-foreground">
                            {s.location ?? (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-foreground">
                            {PREPARATION_STATUS_LABELS[s.preparationStatus]}
                          </td>
                          <td className="px-4 py-2 text-right">
                            <Link
                              href={`/houyou/${s.id}/edit`}
                              className="inline-block rounded border border-border px-3 py-1 text-xs text-foreground hover:bg-muted"
                            >
                              編集
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ===== 会計 (護持会費・入出金) ===== */}
        <TabsContent value="kaikei" className="space-y-5">
          <div className="rounded border border-border bg-surface p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-medium">護持会費</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {feePlan
                    ? `年額 ${formatGojikaiYen(feePlan.annualAmount)}・${MAINTENANCE_FEE_METHOD_LABELS[feePlan.method]}${feePlan.isActive ? '' : '（休止中）'}`
                    : 'この世帯の会費台帳はまだ登録されていません。'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/furikae/household/${household.id}`}
                  className="rounded border border-border px-4 py-2 text-sm text-foreground hover:bg-muted"
                >
                  郵便振替用紙
                </Link>
                {feePlan ? (
                  <Link
                    href={`/gojikai/daichou/${household.id}/edit`}
                    className="rounded border border-border px-4 py-2 text-sm text-foreground hover:bg-muted"
                  >
                    台帳を編集
                  </Link>
                ) : (
                  <Link
                    href="/gojikai/daichou/new"
                    className="inline-flex min-h-touch items-center rounded bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-hover"
                  >
                    + 会費台帳を登録
                  </Link>
                )}
              </div>
            </div>

            {feeInvoices.length > 0 && (
              <div className="mt-5 overflow-hidden rounded border border-border">
                <table className="w-full divide-y divide-border text-sm">
                  <thead className="bg-brand text-left text-xs uppercase tracking-wider text-brand-foreground">
                    <tr>
                      <th className="px-4 py-2">年度</th>
                      <th className="px-4 py-2 text-right">請求額</th>
                      <th className="px-4 py-2 text-right">入金額</th>
                      <th className="px-4 py-2 text-right">残額</th>
                      <th className="px-4 py-2">状況</th>
                      <th className="px-4 py-2 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {feeInvoices.map((inv) => {
                      const outstanding = Math.max(0, inv.amount - inv.paidAmount);
                      return (
                        <tr key={inv.id} className="hover:bg-muted">
                          <td className="px-4 py-2 font-medium text-foreground">
                            {inv.fiscalYear} 年度
                          </td>
                          <td className="px-4 py-2 text-right text-foreground">
                            {formatGojikaiYen(inv.amount)}
                          </td>
                          <td className="px-4 py-2 text-right text-foreground">
                            {formatGojikaiYen(inv.paidAmount)}
                          </td>
                          <td className="px-4 py-2 text-right text-foreground">
                            {formatGojikaiYen(outstanding)}
                          </td>
                          <td className="px-4 py-2 text-foreground">
                            {INVOICE_STATUS_LABELS[inv.status]}
                          </td>
                          <td className="px-4 py-2 text-right">
                            <Link
                              href={`/gojikai/seikyu/${inv.id}`}
                              className="inline-block rounded border border-border px-3 py-1 text-xs text-foreground hover:bg-muted"
                            >
                              入金記録
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded border border-border bg-surface p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-medium">入出金履歴</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {transactions.length === 0
                    ? 'この世帯の入出金記録はまだありません。'
                    : `登録件数: ${transactions.length} 件 (新しい順)`}
                </p>
              </div>
              <Link
                href={`/kaikei/new?householdId=${household.id}`}
                className="inline-flex min-h-touch items-center rounded bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-hover"
              >
                + 入出金を登録
              </Link>
            </div>

            {transactions.length > 0 && (
              <div className="mt-5 overflow-hidden rounded border border-border">
                <table className="w-full divide-y divide-border text-sm">
                  <thead className="bg-brand text-left text-xs uppercase tracking-wider text-brand-foreground">
                    <tr>
                      <th className="px-4 py-2">日付</th>
                      <th className="px-4 py-2">区分</th>
                      <th className="px-4 py-2">カテゴリ</th>
                      <th className="px-4 py-2 text-right">金額</th>
                      <th className="px-4 py-2">支払方法</th>
                      <th className="px-4 py-2 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {transactions.map((t) => (
                      <tr key={t.id} className="hover:bg-muted">
                        <td className="px-4 py-2 text-foreground">
                          <Link href={`/kaikei/${t.id}`} className="hover:underline">
                            {`${t.paidAt.getUTCFullYear()}/${t.paidAt.getUTCMonth() + 1}/${t.paidAt.getUTCDate()}`}
                          </Link>
                        </td>
                        <td className="px-4 py-2 text-foreground">
                          <span
                            className={`inline-block rounded px-2 py-0.5 text-xs ${
                              t.direction === 'INCOME'
                                ? 'bg-green-50 text-green-800'
                                : 'bg-orange-50 text-orange-800'
                            }`}
                          >
                            {TRANSACTION_DIRECTION_LABELS[t.direction]}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-foreground">
                          {TRANSACTION_CATEGORY_LABELS[t.category]}
                        </td>
                        <td className="px-4 py-2 text-right font-medium text-foreground">
                          {t.amount.toLocaleString('ja-JP')} 円
                        </td>
                        <td className="px-4 py-2 text-foreground">
                          {t.paymentMethod ?? <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <Link
                            href={`/kaikei/${t.id}/edit`}
                            className="inline-block rounded border border-border px-3 py-1 text-xs text-foreground hover:bg-muted"
                          >
                            編集
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ===== 区画 ===== */}
        <TabsContent value="kukaku" className="space-y-5">
          <div className="rounded border border-border bg-surface p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-medium">区画</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {gravePlots.length === 0
                    ? 'この世帯が契約している区画はありません。'
                    : `契約件数: ${gravePlots.length} 件 (墓じまい済を含む)`}
                </p>
              </div>
              <Link
                href="/kukaku"
                className="rounded border border-border px-4 py-2 text-sm text-foreground hover:bg-muted"
              >
                区画一覧へ
              </Link>
            </div>

            {gravePlots.length > 0 && (
              <div className="mt-5 overflow-hidden rounded border border-border">
                <table className="w-full divide-y divide-border text-sm">
                  <thead className="bg-brand text-left text-xs uppercase tracking-wider text-brand-foreground">
                    <tr>
                      <th className="px-4 py-2">区画番号</th>
                      <th className="px-4 py-2">種別</th>
                      <th className="px-4 py-2">状態</th>
                      <th className="px-4 py-2">契約日</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {gravePlots.map((p) => (
                      <tr key={p.id} className="hover:bg-muted">
                        <td className="px-4 py-2 font-medium text-foreground">
                          <Link
                            href={`/kukaku/${p.id}`}
                            className="text-foreground underline decoration-border underline-offset-2 hover:decoration-brand"
                          >
                            {p.plotNumber}
                          </Link>
                        </td>
                        <td className="px-4 py-2 text-foreground">
                          {GRAVE_PLOT_TYPE_LABELS[p.plotType]}
                        </td>
                        <td className="px-4 py-2 text-foreground">
                          <GravePlotStatusBadge status={p.status} />
                        </td>
                        <td className="px-4 py-2 text-foreground">
                          {p.contractDate
                            ? `${p.contractDate.getUTCFullYear()}/${p.contractDate.getUTCMonth() + 1}/${p.contractDate.getUTCDate()}`
                            : <span className="text-muted-foreground">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* お墓に納骨されている故人 (区画 → カルテ の双方向表示) */}
          <div className="rounded border border-border bg-surface p-6">
            <div>
              <h2 className="text-lg font-medium">お墓に納骨されている故人</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {householdBurials.length === 0
                  ? 'この家の故人が納骨されているお墓はまだ登録されていません。'
                  : 'この家の故人が、どのお墓に納められているかを表示します。'}
              </p>
            </div>

            {householdBurials.length > 0 && (
              <div className="mt-5 overflow-hidden rounded border border-border">
                <table className="w-full divide-y divide-border text-sm">
                  <thead className="bg-brand text-left text-xs uppercase tracking-wider text-brand-foreground">
                    <tr>
                      <th className="px-4 py-2">故人 (俗名)</th>
                      <th className="px-4 py-2">戒名</th>
                      <th className="px-4 py-2">納骨先区画</th>
                      <th className="px-4 py-2">区画状態</th>
                      <th className="px-4 py-2">納骨日</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {householdBurials.map((b) => (
                      <tr key={b.id} className="hover:bg-muted">
                        <td className="px-4 py-2 font-medium text-foreground">
                          {b.person.secularName ?? b.person.name}
                        </td>
                        <td className="px-4 py-2 text-foreground">
                          {b.person.kaimyoName ?? (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-foreground">
                          <Link
                            href={`/kukaku/${b.gravePlot.id}`}
                            className="text-foreground underline decoration-border underline-offset-2 hover:decoration-brand"
                          >
                            {b.gravePlot.plotNumber}
                          </Link>
                          {b.removedAt && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              (改葬済)
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-foreground">
                          <GravePlotStatusBadge status={b.gravePlot.status} />
                        </td>
                        <td className="px-4 py-2 text-foreground">
                          {b.interredAt
                            ? `${b.interredAt.getUTCFullYear()}/${b.interredAt.getUTCMonth() + 1}/${b.interredAt.getUTCDate()}`
                            : <span className="text-muted-foreground">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ===== 書類 ===== */}
        <TabsContent value="documents">
          <DocumentSection
            target={{ kind: 'household', id: household.id }}
            documents={documents}
            canEdit={canEditDocs}
            canDelete={canDeleteDocs}
          />
        </TabsContent>
      </Tabs>

      <HouseholdActionBar
        householdId={household.id}
        interactionTabValue="interactions"
      />
    </div>
  );
}
