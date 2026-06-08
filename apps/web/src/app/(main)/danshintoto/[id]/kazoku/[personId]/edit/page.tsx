import Link from 'next/link';
import { notFound } from 'next/navigation';
import { updateFamilyMemberAction } from '@/features/kazoku/actions';
import { DeleteFamilyMemberButton } from '@/features/kazoku/DeleteFamilyMemberButton';
import { FamilyMemberForm } from '@/features/kazoku/FamilyMemberForm';
import { getLivingMemberById } from '@/features/kazoku/queries';
import { getHouseholdById } from '@/features/danshintoto/queries';

function toIsoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default async function EditFamilyMemberPage({
  params,
}: {
  params: Promise<{ id: string; personId: string }>;
}) {
  const { id, personId } = await params;
  const [household, person] = await Promise.all([
    getHouseholdById(id),
    getLivingMemberById(personId),
  ]);

  if (!household || !person) {
    notFound();
  }
  if (person.householdId !== household.id) {
    notFound();
  }

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
          <span className="text-foreground">家族構成員編集</span>
        </nav>
        <h1 className="mt-2 text-2xl font-rounded tracking-wider">
          家族構成員を編集する
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {person.name}
          {person.familyRelation && (
            <span className="ml-2 text-muted-foreground">({person.familyRelation})</span>
          )}
        </p>
      </div>

      <div className="rounded border border-border bg-surface p-6">
        <FamilyMemberForm
          action={updateFamilyMemberAction}
          submitLabel="保存する"
          personId={person.id}
          cancelHref={`/danshintoto/${household.id}`}
          initialValues={{
            name: person.name,
            nameKana: person.nameKana,
            familyRelation: person.familyRelation ?? '',
            birthDate: person.birthDate ? toIsoDate(person.birthDate) : '',
          }}
        />
      </div>

      <div className="rounded border border-red-200 bg-red-50 p-6">
        <h2 className="text-base font-medium text-red-900">削除</h2>
        <p className="mt-2 text-sm text-red-800">
          誤登録や重複の修正目的で、この家族構成員を削除します。
          <br />
          過去帳に登録された故人はここから削除できません (過去帳側で管理)。
        </p>
        <div className="mt-4">
          <DeleteFamilyMemberButton
            personId={person.id}
            personName={person.name}
          />
        </div>
      </div>
    </div>
  );
}
