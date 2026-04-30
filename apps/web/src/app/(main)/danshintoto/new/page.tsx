import Link from 'next/link';
import { createHouseholdAction } from '@/features/danshintoto/actions';
import { HouseholdForm } from '@/features/danshintoto/HouseholdForm';

export default function NewHouseholdPage() {
  return (
    <div className="space-y-6">
      <div>
        <nav className="text-sm text-gray-500">
          <Link href="/danshintoto" className="hover:underline">
            檀信徒カルテ
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-700">新規登録</span>
        </nav>
        <h1 className="mt-2 text-2xl font-serif tracking-wider">
          世帯を登録する
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          施主名とふりがなが必須です。その他の項目は後からでも追記できます。
        </p>
      </div>

      <div className="rounded border border-gray-200 bg-white p-6">
        <HouseholdForm
          action={createHouseholdAction}
          submitLabel="登録する"
          cancelHref="/danshintoto"
        />
      </div>
    </div>
  );
}
