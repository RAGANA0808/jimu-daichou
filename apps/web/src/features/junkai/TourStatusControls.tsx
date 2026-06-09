'use client';

import { useTransition } from 'react';
import { CircuitTourStatus } from '@prisma/client';
import { Badge } from '@/components/ui';
import { setCircuitTourStatusAction } from './actions';
import {
  CIRCUIT_TOUR_STATUS_BADGE_VARIANT,
  CIRCUIT_TOUR_STATUS_LABELS,
} from './types';

const TOUR_STATUS_ORDER: CircuitTourStatus[] = [
  CircuitTourStatus.PLANNED,
  CircuitTourStatus.DONE,
  CircuitTourStatus.CANCELED,
];

type Props = {
  circuitTourId: string;
  status: CircuitTourStatus;
  canEdit: boolean;
};

/**
 * 巡回の状況 (予定 / 実施済み / 中止)。
 * canEdit=false のときはバッジ表示のみ。
 */
export function TourStatusControls({ circuitTourId, status, canEdit }: Props) {
  const [isPending, startTransition] = useTransition();

  if (!canEdit) {
    return (
      <Badge variant={CIRCUIT_TOUR_STATUS_BADGE_VARIANT[status]}>
        {CIRCUIT_TOUR_STATUS_LABELS[status]}
      </Badge>
    );
  }

  function handleSet(next: CircuitTourStatus) {
    if (next === status) return;
    const fd = new FormData();
    fd.set('circuitTourId', circuitTourId);
    fd.set('status', next);
    startTransition(() => {
      void setCircuitTourStatusAction(fd);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant={CIRCUIT_TOUR_STATUS_BADGE_VARIANT[status]}>
        {CIRCUIT_TOUR_STATUS_LABELS[status]}
      </Badge>
      <div className="flex flex-wrap items-center gap-1">
        {TOUR_STATUS_ORDER.map((s) => {
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
              {CIRCUIT_TOUR_STATUS_LABELS[s]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
