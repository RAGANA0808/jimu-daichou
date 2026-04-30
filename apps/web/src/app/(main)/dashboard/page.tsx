import Link from 'next/link';
import { requireCurrentUser } from '@/lib/auth';

export default async function DashboardPage() {
  const user = await requireCurrentUser();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif tracking-wider">ダッシュボード</h1>
        <p className="mt-1 text-sm text-gray-600">
          ようこそ、{user.displayName} さん。
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/danshintoto"
          className="block rounded border border-gray-200 bg-white p-6 hover:border-gray-400 hover:shadow-sm"
        >
          <h2 className="text-lg font-medium">檀信徒カルテ</h2>
          <p className="mt-1 text-sm text-gray-600">
            世帯の登録・閲覧・編集
          </p>
        </Link>
        <Link
          href="/nenki"
          className="block rounded border border-gray-200 bg-white p-6 hover:border-gray-400 hover:shadow-sm"
        >
          <h2 className="text-lg font-medium">年忌表</h2>
          <p className="mt-1 text-sm text-gray-600">
            今年の年忌対象者を一覧表示
          </p>
        </Link>
        <Link
          href="/houyou"
          className="block rounded border border-gray-200 bg-white p-6 hover:border-gray-400 hover:shadow-sm"
        >
          <h2 className="text-lg font-medium">法要</h2>
          <p className="mt-1 text-sm text-gray-600">
            今後の法要予定の登録・管理
          </p>
        </Link>
        <Link
          href="/kukaku"
          className="block rounded border border-gray-200 bg-white p-6 hover:border-gray-400 hover:shadow-sm"
        >
          <h2 className="text-lg font-medium">区画</h2>
          <p className="mt-1 text-sm text-gray-600">
            墓地区画の管理 (空き・契約・墓じまい)
          </p>
        </Link>
        <Link
          href="/kaikei"
          className="block rounded border border-gray-200 bg-white p-6 hover:border-gray-400 hover:shadow-sm"
        >
          <h2 className="text-lg font-medium">会計</h2>
          <p className="mt-1 text-sm text-gray-600">
            護持会費・御布施・寄付・経費の入出金管理
          </p>
        </Link>
      </div>

      <div className="rounded border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-medium">セッション情報</h2>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-gray-500">メール</dt>
          <dd className="font-mono">{user.email}</dd>
          <dt className="text-gray-500">役職</dt>
          <dd>{user.role}</dd>
          <dt className="text-gray-500">テナント ID</dt>
          <dd className="font-mono text-xs">{user.tenantId}</dd>
        </dl>
      </div>
    </div>
  );
}
