import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getGravePlotById } from '@/features/kukaku/queries';
import { listBurialsByPlot } from '@/features/kukaku/burial-queries';
import {
  getActiveGraveContractByPlot,
} from '@/features/kukaku/contract-queries';
import { softDeleteBurialAction } from '@/features/kukaku/burial-actions';
import { ReintermentButton } from '@/features/kukaku/ReintermentButton';
import { GravePlotStatusBadge } from '@/features/kukaku/StatusBadge';
import {
  GRAVE_CONTRACT_STATUS_LABELS,
  GRAVE_CONTRACT_TYPE_LABELS,
  GRAVE_PLOT_STATUS_LABELS,
  GRAVE_PLOT_TYPE_LABELS,
} from '@/features/kukaku/types';
import { monthsUntil } from '@/lib/grave/contract';
import { getCurrentRole } from '@/lib/auth';
import { can } from '@/lib/auth/rbac-core';
import { KyoshiActions } from '@/features/kukaku/KyoshiActions';
import { formatDeathDateSeireki } from '@/lib/kakochou';
import {
  getGravePlanByPlot,
  listInvoicesByPlot,
} from '@/features/bochi/queries';
import { GRAVE_MAINTENANCE_METHOD_LABELS } from '@/lib/bochi';
import { DocumentSection } from '@/features/documents/DocumentSection';
import { listDocumentsByGravePlot } from '@/features/documents/queries';

function formatYen(n: number): string {
  return `${n.toLocaleString('ja-JP')} 円`;
}

function formatJaDate(d: Date): string {
  return `${d.getUTCFullYear()}/${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

function formatTimestamp(d: Date): string {
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined | React.ReactNode;
}) {
  return (
    <>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">
        {value ? value : <span className="text-muted-foreground">—</span>}
      </dd>
    </>
  );
}

export default async function GravePlotDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const plot = await getGravePlotById(id);
  if (!plot) {
    notFound();
  }

  const [
    maintenancePlan,
    maintenanceInvoices,
    burials,
    contract,
    role,
    documents,
  ] = await Promise.all([
    getGravePlanByPlot(id),
    listInvoicesByPlot(id),
    listBurialsByPlot(id),
    getActiveGraveContractByPlot(id),
    getCurrentRole(),
    listDocumentsByGravePlot(id),
  ]);
  // 破壊的操作 (合祀・墓じまい) は PRIEST 以上のみ。STAFF/READ_ONLY には操作 UI を出さない。
  const canDestructive = role !== null && can(role, 'destructive');
  const canEditDocs = role !== null && can(role, 'create');
  const maintenanceOutstanding = maintenanceInvoices.reduce(
    (s, inv) => s + Math.max(0, inv.amount - inv.paidAmount),
    0,
  );

  const activeBurials = burials.filter((b) => b.removedAt === null);
  const contractMonthsLeft = contract
    ? monthsUntil(contract.expiryDate)
    : null;
  const contractExpiringSoon =
    contractMonthsLeft !== null && contractMonthsLeft <= 12;

  return (
    <div className="space-y-6">
      <div>
        <nav className="text-sm text-muted-foreground">
          <Link href="/dashboard" className="hover:underline">
            ダッシュボード
          </Link>
          <span className="mx-2">/</span>
          <Link href="/kukaku" className="hover:underline">
            区画
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">{plot.plotNumber}</span>
        </nav>
        <div className="mt-2 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-rounded tracking-wider">
              区画 {plot.plotNumber}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {GRAVE_PLOT_TYPE_LABELS[plot.plotType]} — {GRAVE_PLOT_STATUS_LABELS[plot.status]}
            </p>
          </div>
          <Link
            href={`/kukaku/${plot.id}/edit`}
            className="rounded border border-border px-4 py-2 text-sm text-foreground hover:bg-muted"
          >
            編集
          </Link>
        </div>
      </div>

      <div className="rounded border border-border bg-surface p-6">
        <h2 className="text-lg font-medium">区画情報</h2>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3">
          <DetailRow label="区画番号" value={plot.plotNumber} />
          <DetailRow
            label="種別"
            value={GRAVE_PLOT_TYPE_LABELS[plot.plotType]}
          />
          <DetailRow
            label="状態"
            value={<GravePlotStatusBadge status={plot.status} />}
          />
          <DetailRow
            label="契約世帯"
            value={
              plot.household ? (
                <Link
                  href={`/danshintoto/${plot.household.id}`}
                  className="text-foreground underline decoration-border underline-offset-2 hover:decoration-brand"
                >
                  {plot.household.householderName}
                </Link>
              ) : null
            }
          />
          <DetailRow
            label="エリア"
            value={
              plot.area ? (
                <span>
                  {plot.area.name}
                  {plot.positionX !== null && plot.positionY !== null && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      (配置済: {plot.positionX}, {plot.positionY})
                    </span>
                  )}
                </span>
              ) : null
            }
          />
          <DetailRow
            label="契約日"
            value={plot.contractDate ? formatJaDate(plot.contractDate) : null}
          />
          <DetailRow label="契約プラン" value={plot.contractPlan} />
          <DetailRow label="墓標名" value={plot.monumentName} />
          <DetailRow label="刻名" value={plot.inscription} />
        </dl>
      </div>

      {/* ===== 納骨されている故人 ===== */}
      <div className="rounded border border-border bg-surface p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-medium">納骨されている故人</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {activeBurials.length === 0
                ? 'この区画に納骨されている故人はまだ登録されていません。'
                : `納骨中: ${activeBurials.length} 名${burials.length > activeBurials.length ? `（ほか改葬済 ${burials.length - activeBurials.length} 名）` : ''}`}
            </p>
          </div>
          <Link
            href={`/kukaku/${plot.id}/burial/new`}
            className="inline-flex min-h-touch items-center rounded bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-hover"
          >
            ＋ 納骨を記録
          </Link>
        </div>

        {burials.length > 0 && (
          <div className="mt-5 overflow-hidden rounded border border-border">
            <table className="w-full divide-y divide-border text-sm">
              <thead className="bg-brand text-left text-xs uppercase tracking-wider text-brand-foreground">
                <tr>
                  <th className="px-4 py-2">俗名</th>
                  <th className="px-4 py-2">戒名</th>
                  <th className="px-4 py-2">没年月日</th>
                  <th className="px-4 py-2">納骨日</th>
                  <th className="px-4 py-2">状態</th>
                  <th className="px-4 py-2 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {burials.map((b) => {
                  const entry = b.person.deathLedgerEntry;
                  const deathDate = entry
                    ? (entry.dateOfDeathWareki ??
                      formatDeathDateSeireki({
                        precision: entry.datePrecision,
                        year: entry.deathYear,
                        month: entry.deathMonth,
                        day: entry.deathDay,
                      }))
                    : '—';
                  return (
                    <tr key={b.id} className="hover:bg-muted">
                      <td className="px-4 py-2 font-medium text-foreground">
                        {entry ? (
                          <Link
                            href={`/danshintoto/${b.person.householdId}/kakochou/${entry.id}`}
                            className="text-foreground underline decoration-border underline-offset-2 hover:decoration-brand"
                          >
                            {b.person.name}
                          </Link>
                        ) : (
                          b.person.name
                        )}
                      </td>
                      <td className="px-4 py-2 text-foreground">
                        {entry?.kaimyoName ?? (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-foreground">{deathDate}</td>
                      <td className="px-4 py-2 text-foreground">
                        {b.interredAt ? (
                          formatJaDate(b.interredAt)
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        {b.removedAt ? (
                          <span className="inline-block rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            改葬済 ({formatJaDate(b.removedAt)})
                          </span>
                        ) : (
                          <span className="inline-block rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-800">
                            納骨中
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex justify-end gap-2">
                          {b.removedAt === null && (
                            <ReintermentButton
                              burialId={b.id}
                              gravePlotId={plot.id}
                              personName={b.person.name}
                            />
                          )}
                          <form action={softDeleteBurialAction}>
                            <input
                              type="hidden"
                              name="burialId"
                              value={b.id}
                            />
                            <input
                              type="hidden"
                              name="gravePlotId"
                              value={plot.id}
                            />
                            <button
                              type="submit"
                              className="rounded border border-red-300 px-3 py-1 text-xs text-red-800 hover:bg-red-50"
                            >
                              除外
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ===== 契約情報 ===== */}
      <div className="rounded border border-border bg-surface p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-medium">契約情報</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              永代供養・通常使用などの契約条件と満了日 (合祀期限) を管理します。
            </p>
          </div>
          {contract ? (
            <Link
              href={`/kukaku/${plot.id}/contract/${contract.id}/edit`}
              className="rounded border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted"
            >
              契約を編集
            </Link>
          ) : (
            <Link
              href={`/kukaku/${plot.id}/contract/new`}
              className="inline-flex min-h-touch items-center rounded bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-hover"
            >
              ＋ 契約を登録
            </Link>
          )}
        </div>
        {contract ? (
          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3">
            <DetailRow
              label="契約種別"
              value={GRAVE_CONTRACT_TYPE_LABELS[contract.contractType]}
            />
            <DetailRow
              label="開始日"
              value={contract.startDate ? formatJaDate(contract.startDate) : null}
            />
            <DetailRow
              label="預かり年数"
              value={
                contract.termYears !== null
                  ? `${contract.termYears} 年`
                  : '永代 (期限なし)'
              }
            />
            <DetailRow
              label="満了日 (合祀期限)"
              value={
                contract.expiryDate ? (
                  <span className={contractExpiringSoon ? 'text-danger' : undefined}>
                    {formatJaDate(contract.expiryDate)}
                    {contractMonthsLeft !== null && (
                      <span className="ml-2 text-xs">
                        {contractMonthsLeft < 0
                          ? `（満了済）`
                          : `（残り約 ${contractMonthsLeft} ヶ月）`}
                      </span>
                    )}
                  </span>
                ) : null
              }
            />
            <DetailRow
              label="契約状態"
              value={GRAVE_CONTRACT_STATUS_LABELS[contract.status]}
            />
            <DetailRow
              label="契約料・管理料"
              value={
                contract.feeAmount !== null
                  ? formatYen(contract.feeAmount)
                  : null
              }
            />
            <DetailRow label="備考" value={contract.memo} />
          </dl>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            この区画には契約がまだ登録されていません。
          </p>
        )}
      </div>

      {/* ===== 合祀・墓じまいの手続き (G-8: 破壊的・手動確定) ===== */}
      {canDestructive && (
        <div className="rounded border border-border bg-surface p-6">
          <h2 className="text-lg font-medium">合祀・墓じまいの手続き</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            合祀への移行・墓じまい（契約解約）を確定します。いずれも理由の入力と確認が必要で、
            元に戻せません。住職・僧侶のみ操作できます。
          </p>
          {contractExpiringSoon && (
            <div className="mt-4 rounded border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning">
              {contractMonthsLeft !== null && contractMonthsLeft < 0
                ? '満了日（合祀期限）を過ぎています。合祀移行のご案内漏れにご注意ください。'
                : '満了日（合祀期限）が間近です。合祀移行・墓じまいのご検討時期です。'}
            </div>
          )}
          <div className="mt-4">
            <KyoshiActions
              gravePlotId={plot.id}
              contractId={contract?.id ?? null}
              alreadyInterred={plot.status === 'INTERRED_TOGETHER'}
              hasActiveBurials={activeBurials.length > 0}
            />
          </div>
        </div>
      )}

      <div className="rounded border border-border bg-surface p-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-medium">墓地 年間管理料</h2>
          {maintenancePlan ? (
            <Link
              href={`/bochi/daichou/${plot.id}/edit`}
              className="rounded border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted"
            >
              台帳を編集
            </Link>
          ) : (
            <Link
              href="/bochi/daichou/new"
              className="rounded border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted"
            >
              台帳を登録
            </Link>
          )}
        </div>
        {maintenancePlan ? (
          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3">
            <DetailRow
              label="年額管理料"
              value={formatYen(maintenancePlan.annualAmount)}
            />
            <DetailRow
              label="納入区分"
              value={GRAVE_MAINTENANCE_METHOD_LABELS[maintenancePlan.method]}
            />
            <DetailRow
              label="状態"
              value={maintenancePlan.isActive ? '有効' : '休止'}
            />
            <DetailRow label="賦課根拠" value={maintenancePlan.basis} />
            <DetailRow
              label="未納額 (全年度)"
              value={
                maintenanceOutstanding > 0 ? (
                  <span className="text-danger">
                    {formatYen(maintenanceOutstanding)}
                  </span>
                ) : (
                  '未納なし'
                )
              }
            />
          </dl>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            この区画には管理料台帳がまだ登録されていません。
          </p>
        )}
        {maintenanceInvoices.length > 0 && (
          <div className="mt-4 border-t border-border pt-4">
            <p className="mb-2 text-sm text-muted-foreground">請求・入金状況</p>
            <ul className="space-y-1 text-sm">
              {maintenanceInvoices.map((inv) => (
                <li key={inv.id}>
                  <Link
                    href={`/bochi/seikyu/${inv.id}`}
                    className="text-foreground underline decoration-border underline-offset-2 hover:decoration-brand"
                  >
                    {inv.fiscalYear} 年度: {formatYen(inv.paidAmount)} /{' '}
                    {formatYen(inv.amount)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <DocumentSection
        target={{ kind: 'gravePlot', id: plot.id }}
        documents={documents}
        canEdit={canEditDocs}
        canDelete={canDestructive}
      />

      <div className="rounded border border-border bg-surface p-6">
        <h2 className="text-lg font-medium">備考</h2>
        <div className="mt-3 whitespace-pre-wrap text-sm text-foreground">
          {plot.memo && plot.memo.length > 0 ? (
            plot.memo
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </div>
      </div>

      <div className="rounded border border-border bg-surface p-6 text-sm text-muted-foreground">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
          <dt>登録日</dt>
          <dd>{formatTimestamp(plot.createdAt)}</dd>
          <dt>最終更新</dt>
          <dd>{formatTimestamp(plot.updatedAt)}</dd>
          <dt>区画 ID</dt>
          <dd className="font-mono text-xs">{plot.id}</dd>
        </dl>
      </div>
    </div>
  );
}
