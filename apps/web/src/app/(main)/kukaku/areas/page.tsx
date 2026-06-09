import Link from 'next/link';
import { deleteGravePlotAreaAction } from '@/features/kukaku/areas/actions';
import { listGravePlotAreas } from '@/features/kukaku/areas/queries';
import { DeleteAreaButton } from './DeleteAreaButton';

export default async function GravePlotAreasPage() {
  const areas = await listGravePlotAreas();

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
          <span className="text-foreground">エリア</span>
        </nav>
        <div className="mt-2 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-rounded tracking-wider">
              区画エリア管理
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              地図上でグルーピングする墓地エリア
              (例: 東墓地・西墓地・永代供養区)
              の一覧です。表示順 (昇順) で並びます。
            </p>
          </div>
          <Link
            href="/kukaku/areas/new"
            className="inline-flex min-h-touch items-center rounded bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-hover"
          >
            + 新規登録
          </Link>
        </div>
      </div>

      {areas.length === 0 ? (
        <div className="rounded border border-dashed border-border bg-surface p-10 text-center">
          <p className="text-muted-foreground">エリアはまだ登録されていません。</p>
          <p className="mt-1 text-sm text-muted-foreground">
            地図に区画を配置するには、まず 1 つ以上のエリアが必要です。
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded border border-border bg-surface">
          <table className="w-full divide-y divide-border text-sm">
            <thead className="bg-brand text-left text-xs uppercase tracking-wider text-brand-foreground">
              <tr>
                <th className="px-4 py-3">エリア名</th>
                <th className="px-4 py-3">表示順</th>
                <th className="px-4 py-3">キャンバス</th>
                <th className="px-4 py-3">区画数</th>
                <th className="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {areas.map((a) => (
                <tr key={a.id} className="hover:bg-muted">
                  <td className="px-4 py-3 font-medium text-foreground">
                    {a.name}
                  </td>
                  <td className="px-4 py-3 text-foreground">{a.sortOrder}</td>
                  <td className="px-4 py-3 text-foreground">
                    {a.canvasWidth} × {a.canvasHeight}
                  </td>
                  <td className="px-4 py-3 text-foreground">
                    {a._count.gravePlots}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/kukaku/areas/${a.id}/edit`}
                        className="inline-block rounded border border-border px-3 py-1 text-xs text-foreground hover:bg-muted"
                      >
                        編集
                      </Link>
                      <DeleteAreaButton
                        areaId={a.id}
                        areaName={a.name}
                        plotCount={a._count.gravePlots}
                        action={deleteGravePlotAreaAction}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
