import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getGravePlotById,
  getHouseholdMinimalById,
  listHouseholdsForSelect,
} from '@/features/kukaku/queries';
import { getGraveContractById } from '@/features/kukaku/contract-queries';
import { updateGraveContractAction } from '@/features/kukaku/contract-actions';
import { GraveContractForm } from '@/features/kukaku/GraveContractForm';

function toIsoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default async function EditGraveContractPage({
  params,
}: {
  params: Promise<{ id: string; contractId: string }>;
}) {
  const { id, contractId } = await params;
  const [plot, contract, baseHouseholdOptions] = await Promise.all([
    getGravePlotById(id),
    getGraveContractById(contractId),
    listHouseholdsForSelect(),
  ]);
  if (!plot || !contract || contract.gravePlotId !== plot.id) {
    notFound();
  }

  // 契約世帯が候補に含まれない (離檀済) 場合は補完する。
  const householdOptions = [...baseHouseholdOptions];
  if (
    contract.householdId &&
    !householdOptions.some((h) => h.id === contract.householdId)
  ) {
    const fallback = await getHouseholdMinimalById(contract.householdId);
    if (fallback) {
      householdOptions.unshift({
        id: fallback.id,
        householderName: fallback.householderName,
        nameKana: `${fallback.nameKana}・離檀済`,
      });
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <nav className="text-sm text-muted-foreground">
          <Link href="/kukaku" className="hover:underline">
            区画
          </Link>
          <span className="mx-2">/</span>
          <Link href={`/kukaku/${plot.id}`} className="hover:underline">
            {plot.plotNumber}
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">契約を編集</span>
        </nav>
        <h1 className="mt-2 text-2xl font-rounded tracking-wider">
          契約を編集する
        </h1>
      </div>

      <div className="rounded border border-border bg-surface p-6">
        <GraveContractForm
          action={updateGraveContractAction}
          submitLabel="保存する"
          cancelHref={`/kukaku/${plot.id}`}
          gravePlotId={plot.id}
          contractId={contract.id}
          householdOptions={householdOptions}
          initialValues={{
            contractType: contract.contractType,
            householdId: contract.householdId ?? '',
            startDate: contract.startDate ? toIsoDate(contract.startDate) : '',
            termYears:
              contract.termYears !== null ? String(contract.termYears) : '',
            status: contract.status,
            feeAmount:
              contract.feeAmount !== null ? String(contract.feeAmount) : '',
            memo: contract.memo ?? '',
          }}
        />
      </div>
    </div>
  );
}
