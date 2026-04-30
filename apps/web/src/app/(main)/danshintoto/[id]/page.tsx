import Link from 'next/link';
import { notFound } from 'next/navigation';
import { setHouseholdInactiveAction } from '@/features/danshintoto/actions';
import { getHouseholdById } from '@/features/danshintoto/queries';
import { listDeathLedgerEntriesByHousehold } from '@/features/kakochou/queries';
import { listMemorialServicesByHousehold } from '@/features/houyou/queries';
import { PREPARATION_STATUS_LABELS } from '@/features/houyou/types';
import { listLivingMembersByHousehold } from '@/features/kazoku/queries';
import { listGravePlotsByHousehold } from '@/features/kukaku/queries';
import {
  GRAVE_PLOT_STATUS_LABELS,
  GRAVE_PLOT_TYPE_LABELS,
} from '@/features/kukaku/types';

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
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-900">
        {value && value.length > 0 ? value : <span className="text-gray-400">—</span>}
      </dd>
    </>
  );
}

export default async function HouseholdDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const household = await getHouseholdById(id);
  if (!household) {
    notFound();
  }
  const [deathLedgerEntries, memorialServices, familyMembers, gravePlots] =
    await Promise.all([
      listDeathLedgerEntriesByHousehold(household.id),
      listMemorialServicesByHousehold(household.id),
      listLivingMembersByHousehold(household.id),
      listGravePlotsByHousehold(household.id),
    ]);

  return (
    <div className="space-y-6">
      <div>
        <nav className="text-sm text-gray-500">
          <Link href="/danshintoto" className="hover:underline">
            檀信徒カルテ
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-700">{household.householderName}</span>
        </nav>
        <div className="mt-2 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-serif tracking-wider">
              {household.householderName}
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              {household.nameKana}
            </p>
          </div>
          <Link
            href={`/danshintoto/${household.id}/edit`}
            className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            編集
          </Link>
        </div>
      </div>

      <div className="rounded border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-medium">連絡先</h2>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3">
          <DetailRow label="電話" value={household.phone} />
          <DetailRow label="携帯電話" value={household.mobile} />
          <DetailRow label="メール" value={household.email} />
          <DetailRow label="郵便番号" value={household.postalCode} />
          <DetailRow label="住所" value={household.address} />
          <DetailRow label="第 2 連絡先" value={household.secondaryContact} />
        </dl>
      </div>

      <div className="rounded border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-medium">備考</h2>
        <div className="mt-3 whitespace-pre-wrap text-sm text-gray-900">
          {household.memo && household.memo.length > 0 ? (
            household.memo
          ) : (
            <span className="text-gray-400">—</span>
          )}
        </div>
      </div>

      <div className="rounded border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium">家族構成員</h2>
            <p className="mt-1 text-sm text-gray-600">
              {familyMembers.length === 0
                ? 'この世帯の家族構成員はまだ登録されていません。'
                : `登録件数: ${familyMembers.length} 名 (生存者のみ表示)`}
            </p>
          </div>
          <Link
            href={`/danshintoto/${household.id}/kazoku/new`}
            className="rounded bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800"
          >
            + 家族を追加
          </Link>
        </div>

        {familyMembers.length > 0 && (
          <div className="mt-5 overflow-hidden rounded border border-gray-200">
            <table className="w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-4 py-2">続柄</th>
                  <th className="px-4 py-2">氏名</th>
                  <th className="px-4 py-2">ふりがな</th>
                  <th className="px-4 py-2">生年月日</th>
                  <th className="px-4 py-2 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {familyMembers.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-700">
                      {p.familyRelation ?? (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 font-medium text-gray-900">
                      {p.name}
                    </td>
                    <td className="px-4 py-2 text-gray-600">{p.nameKana}</td>
                    <td className="px-4 py-2 text-gray-700">
                      {p.birthDate
                        ? `${p.birthDate.getUTCFullYear()}/${p.birthDate.getUTCMonth() + 1}/${p.birthDate.getUTCDate()}`
                        : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Link
                        href={`/danshintoto/${household.id}/kazoku/${p.id}/edit`}
                        className="inline-block rounded border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-100"
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

      <div className="rounded border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium">過去帳</h2>
            <p className="mt-1 text-sm text-gray-600">
              {deathLedgerEntries.length === 0
                ? 'この世帯の過去帳エントリはまだ登録されていません。'
                : `登録件数: ${deathLedgerEntries.length} 件`}
            </p>
          </div>
          <Link
            href={`/danshintoto/${household.id}/kakochou/new`}
            className="rounded bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800"
          >
            + 過去帳に登録
          </Link>
        </div>

        {deathLedgerEntries.length > 0 && (
          <div className="mt-5 overflow-hidden rounded border border-gray-200">
            <table className="w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-4 py-2">俗名</th>
                  <th className="px-4 py-2">戒名</th>
                  <th className="px-4 py-2">没年月日</th>
                  <th className="px-4 py-2">行年</th>
                  <th className="px-4 py-2">続柄</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {deathLedgerEntries.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-900">
                      <Link
                        href={`/danshintoto/${household.id}/kakochou/${e.id}`}
                        className="hover:underline"
                      >
                        {e.secularName}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-gray-700">
                      {e.kaimyoName ?? (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-gray-700">
                      {e.dateOfDeathWareki ?? formatJaDate(e.dateOfDeath)}
                    </td>
                    <td className="px-4 py-2 text-gray-700">
                      {e.ageAtDeath ?? (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-gray-700">
                      {e.person.familyRelation ?? (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium">法要</h2>
            <p className="mt-1 text-sm text-gray-600">
              {memorialServices.length === 0
                ? 'この世帯の法要予定はまだ登録されていません。'
                : `登録件数: ${memorialServices.length} 件 (過去・中止も含む)`}
            </p>
          </div>
          <Link
            href={`/houyou/new?householdId=${household.id}`}
            className="rounded bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800"
          >
            + 法要を登録
          </Link>
        </div>

        {memorialServices.length > 0 && (
          <div className="mt-5 overflow-hidden rounded border border-gray-200">
            <table className="w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-4 py-2">予定日時</th>
                  <th className="px-4 py-2">法要名</th>
                  <th className="px-4 py-2">場所</th>
                  <th className="px-4 py-2">状況</th>
                  <th className="px-4 py-2 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {memorialServices.map((s) => {
                  const dt = s.scheduledAt;
                  const formatted = `${dt.getFullYear()}/${dt.getMonth() + 1}/${dt.getDate()} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
                  return (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-700">{formatted}</td>
                      <td className="px-4 py-2 font-medium text-gray-900">
                        <Link
                          href={`/houyou/${s.id}`}
                          className="text-gray-900 underline decoration-gray-300 underline-offset-2 hover:decoration-gray-900"
                        >
                          {s.serviceName}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-gray-700">
                        {s.location ?? (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-gray-700">
                        {PREPARATION_STATUS_LABELS[s.preparationStatus]}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Link
                          href={`/houyou/${s.id}/edit`}
                          className="inline-block rounded border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-100"
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

      <div className="rounded border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium">区画</h2>
            <p className="mt-1 text-sm text-gray-600">
              {gravePlots.length === 0
                ? 'この世帯が契約している区画はありません。'
                : `契約件数: ${gravePlots.length} 件 (墓じまい済を含む)`}
            </p>
          </div>
          <Link
            href="/kukaku"
            className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            区画一覧へ
          </Link>
        </div>

        {gravePlots.length > 0 && (
          <div className="mt-5 overflow-hidden rounded border border-gray-200">
            <table className="w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-4 py-2">区画番号</th>
                  <th className="px-4 py-2">種別</th>
                  <th className="px-4 py-2">状態</th>
                  <th className="px-4 py-2">契約日</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {gravePlots.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-900">
                      <Link
                        href={`/kukaku/${p.id}`}
                        className="text-gray-900 underline decoration-gray-300 underline-offset-2 hover:decoration-gray-900"
                      >
                        {p.plotNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-gray-700">
                      {GRAVE_PLOT_TYPE_LABELS[p.plotType]}
                    </td>
                    <td className="px-4 py-2 text-gray-700">
                      {GRAVE_PLOT_STATUS_LABELS[p.status]}
                    </td>
                    <td className="px-4 py-2 text-gray-700">
                      {p.contractDate
                        ? `${p.contractDate.getUTCFullYear()}/${p.contractDate.getUTCMonth() + 1}/${p.contractDate.getUTCDate()}`
                        : <span className="text-gray-400">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded border border-gray-200 bg-white p-6 text-sm text-gray-500">
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
            className="rounded border border-red-300 bg-white px-4 py-2 text-sm text-red-800 hover:bg-red-100"
          >
            離檀として記録する
          </button>
        </form>
      </div>
    </div>
  );
}
