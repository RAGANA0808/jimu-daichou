'use client';

import { useTransition } from 'react';
import { CircuitStopStatus } from '@prisma/client';
import { Badge } from '@/components/ui';
import { setCircuitStopStatusAction } from './actions';
import {
  CIRCUIT_STOP_STATUS_BADGE_VARIANT,
  CIRCUIT_STOP_STATUS_LABELS,
} from './types';

const STOP_STATUS_ORDER: CircuitStopStatus[] = [
  CircuitStopStatus.PENDING,
  CircuitStopStatus.VISITED,
  CircuitStopStatus.SKIPPED,
];

type Props = {
  circuitTourId: string;
  circuitStopId: string;
  status: CircuitStopStatus;
  canEdit: boolean;
};

/**
 * 訪問先の状況 (未訪問 / 訪問済み / 不在・見送り)。
 * canEdit=false のときはバッジ表示のみ。
 */
export function StopStatusControls({
  circuitTourId,
  circuitStopId,
  status,
  canEdit,
}: Props) {
  const [isPending, startTransition] = useTransition();

  if (!canEdit) {
    return (
      <Badge variant={CIRCUIT_STOP_STATUS_BADGE_VARIANT[status]}>
        {CIRCUIT_STOP_STATUS_LABELS[status]}
      </Badge>
    );
  }

  function handleSet(next: CircuitStopStatus) {
    if (next === status) return;
    const fd = new FormData();
    fd.set('circuitTourId', circuitTourId);
    fd.set('circuitStopId', circuitStopId);
    fd.set('status', next);
    startTransition(() => {
      void setCircuitStopStatusAction(fd);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {STOP_STATUS_ORDER.map((s) => {
        const active = s === status;
        return (
          <button
            key={s}
            type="button"
            onClick={() => handleSet(s)}
            disabled={isPending || active}
            aria-pressed={active}
            className={`rounded border px-2 py-1 text-xs transition-colors disabled:cursor-not-allowed ${
              active
                ? 'border-brand bg-brand text-brand-foreground'
                : 'border-border text-foreground hover:bg-muted disabled:opacity-50'
            }`}
          >
            {CIRCUIT_STOP_STATUS_LABELS[s]}
          </button>
        );
      })}
    </div>
  );
}
