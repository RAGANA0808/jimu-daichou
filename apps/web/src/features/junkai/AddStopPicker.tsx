'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { Button, Input, Select } from '@/components/ui';
import { addCircuitStopAction } from './actions';
import { initialStopFormState } from './types';

export type HouseholdStopOption = { id: string; householderName: string };
export type GravePlotStopOption = { id: string; label: string };

type StopKind = 'household' | 'gravePlot' | 'free';

type Props = {
  circuitTourId: string;
  householdOptions: HouseholdStopOption[];
  gravePlotOptions: GravePlotStopOption[];
};

/**
 * 訪問先を「世帯 / 区画 / 自由記述」のいずれかから追加する。
 * 選んだ種別に応じた 1 フィールドだけを送信し、残りは空のままにする
 * (Server Action 側で 3 種いずれか必須・末尾採番)。
 */
export function AddStopPicker({
  circuitTourId,
  householdOptions,
  gravePlotOptions,
}: Props) {
  const [kind, setKind] = useState<StopKind>('household');
  const [state, formAction, isPending] = useActionState(
    addCircuitStopAction,
    initialStopFormState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  // 追加成功でフォームをリセットし、連続追加しやすくする。
  useEffect(() => {
    if (state.status === 'success') {
      formRef.current?.reset();
      setKind('household');
    }
  }, [state.status]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-3 rounded-lg border border-border bg-muted/30 p-4"
    >
      <input type="hidden" name="circuitTourId" value={circuitTourId} />

      <p className="text-sm font-medium text-foreground">訪問先を追加</p>

      <div className="flex flex-wrap gap-3 text-sm">
        <KindRadio
          name="stopKind"
          value="household"
          checked={kind === 'household'}
          onChange={() => setKind('household')}
          label="世帯から"
        />
        <KindRadio
          name="stopKind"
          value="gravePlot"
          checked={kind === 'gravePlot'}
          onChange={() => setKind('gravePlot')}
          label="区画から"
        />
        <KindRadio
          name="stopKind"
          value="free"
          checked={kind === 'free'}
          onChange={() => setKind('free')}
          label="自由記述"
        />
      </div>

      {kind === 'household' && (
        <div className="space-y-1">
          <label htmlFor="add-stop-household" className="sr-only">
            世帯
          </label>
          <Select id="add-stop-household" name="householdId" defaultValue="">
            <option value="">（世帯を選択）</option>
            {householdOptions.map((h) => (
              <option key={h.id} value={h.id}>
                {h.householderName}
              </option>
            ))}
          </Select>
        </div>
      )}

      {kind === 'gravePlot' && (
        <div className="space-y-1">
          <label htmlFor="add-stop-graveplot" className="sr-only">
            区画
          </label>
          <Select id="add-stop-graveplot" name="gravePlotId" defaultValue="">
            <option value="">（区画を選択）</option>
            {gravePlotOptions.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </Select>
        </div>
      )}

      {kind === 'free' && (
        <div className="space-y-1">
          <label htmlFor="add-stop-visitlabel" className="sr-only">
            訪問先名
          </label>
          <Input
            id="add-stop-visitlabel"
            name="visitLabel"
            maxLength={120}
            placeholder="例: 〇〇会館 / 未登録のお宅"
          />
        </div>
      )}

      {state.formError && (
        <p className="text-sm text-red-700">{state.formError}</p>
      )}
      {state.errors?.visitLabel && (
        <p className="text-sm text-red-700">{state.errors.visitLabel}</p>
      )}

      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? '追加中…' : '＋ 追加する'}
      </Button>
    </form>
  );
}

function KindRadio({
  name,
  value,
  checked,
  onChange,
  label,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label className="inline-flex items-center gap-1.5">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="h-4 w-4"
      />
      <span className="text-foreground">{label}</span>
    </label>
  );
}
