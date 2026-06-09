'use client';

import { useTransition } from 'react';
import type { CircuitStopStatus } from '@prisma/client';
import { removeCircuitStopAction, reorderCircuitStopsAction } from './actions';
import { StopStatusControls } from './StopStatusControls';
import {
  AddStopPicker,
  type GravePlotStopOption,
  type HouseholdStopOption,
} from './AddStopPicker';

export type CircuitStopItem = {
  id: string;
  displayName: string;
  status: CircuitStopStatus;
  memo: string | null;
};

type Props = {
  circuitTourId: string;
  stops: CircuitStopItem[];
  householdOptions: HouseholdStopOption[];
  gravePlotOptions: GravePlotStopOption[];
  canEdit: boolean;
};

/**
 * 訪問先の順序付きリスト。上下ボタンで並べ替える (地図・経路ラインは描かない)。
 * ContactPointEditor の handleMove / IconButton / useTransition 手法を踏襲。
 */
export function StopListEditor({
  circuitTourId,
  stops,
  householdOptions,
  gravePlotOptions,
  canEdit,
}: Props) {
  const [, startTransition] = useTransition();

  function handleMove(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= stops.length) return;
    const ids = stops.map((s) => s.id);
    const moved = ids[index]!;
    ids.splice(index, 1);
    ids.splice(target, 0, moved);
    startTransition(() => {
      void reorderCircuitStopsAction(circuitTourId, ids);
    });
  }

  function handleRemove(id: string) {
    const fd = new FormData();
    fd.set('circuitTourId', circuitTourId);
    fd.set('circuitStopId', id);
    startTransition(() => {
      void removeCircuitStopAction(fd);
    });
  }

  return (
    <div className="space-y-4">
      {stops.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          まだ訪問先は登録されていません。下の「訪問先を追加」からご登録ください。
        </p>
      ) : (
        <ul className="space-y-3">
          {stops.map((s, i) => (
            <li
              key={s.id}
              className="rounded-lg border border-border bg-muted/30 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 rounded-full border border-border bg-surface px-2 py-0.5 text-xs text-muted-foreground">
                      {i + 1}
                    </span>
                    <span className="font-medium text-foreground">
                      {s.displayName}
                    </span>
                  </div>
                  <StopStatusControls
                    circuitTourId={circuitTourId}
                    circuitStopId={s.id}
                    status={s.status}
                    canEdit={canEdit}
                  />
                  {s.memo && (
                    <p className="text-sm text-muted-foreground">{s.memo}</p>
                  )}
                </div>
                {canEdit && (
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <div className="flex gap-1">
                      <IconButton
                        label="上へ"
                        disabled={i === 0}
                        onClick={() => handleMove(i, -1)}
                      >
                        ↑
                      </IconButton>
                      <IconButton
                        label="下へ"
                        disabled={i === stops.length - 1}
                        onClick={() => handleMove(i, 1)}
                      >
                        ↓
                      </IconButton>
                    </div>
                    <SmallButton
                      variant="danger"
                      onClick={() => handleRemove(s.id)}
                    >
                      除外
                    </SmallButton>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <AddStopPicker
          circuitTourId={circuitTourId}
          householdOptions={householdOptions}
          gravePlotOptions={gravePlotOptions}
        />
      )}
    </div>
  );
}

function SmallButton({
  children,
  onClick,
  variant = 'default',
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'danger';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded border px-2 py-1 text-xs transition-colors ${
        variant === 'danger'
          ? 'border-red-300 text-red-800 hover:bg-red-50'
          : 'border-border text-foreground hover:bg-muted'
      }`}
    >
      {children}
    </button>
  );
}

function IconButton({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="rounded border border-border px-2 py-1 text-xs text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
