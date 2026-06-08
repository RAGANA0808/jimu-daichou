'use client';

import { useActionState } from 'react';
import {
  Button,
  Card,
  CardContent,
  FormField,
  Input,
  Select,
  Textarea,
} from '@/components/ui';
import {
  GRAVE_MAINTENANCE_METHOD_LABELS,
  GRAVE_MAINTENANCE_METHOD_ORDER,
} from '@/lib/bochi';
import { saveGravePlanAction } from './actions';
import { initialPlanFormState } from './types';

type PlotOption = {
  id: string;
  plotNumber: string;
  householderName: string | null;
};

type Props = {
  /** 新規: 選択式の区画候補。編集: 単一の固定区画。 */
  mode: 'create' | 'edit';
  plotOptions?: PlotOption[];
  fixedPlot?: { id: string; plotNumber: string; householderName: string | null };
  defaultValues?: {
    annualAmount?: string;
    method?: string;
    basis?: string;
    note?: string;
  };
};

export function PlanForm({ mode, plotOptions, fixedPlot, defaultValues }: Props) {
  const [state, formAction, isPending] = useActionState(
    saveGravePlanAction,
    initialPlanFormState,
  );

  const v = state.values ?? {};
  const dv = defaultValues ?? {};

  return (
    <Card>
      <CardContent className="py-6">
        <form action={formAction} noValidate className="space-y-5">
          {mode === 'edit' && fixedPlot && (
            <>
              <input type="hidden" name="gravePlotId" value={fixedPlot.id} />
              <FormField label="区画">
                {() => (
                  <p className="text-base text-foreground">
                    区画 {fixedPlot.plotNumber}
                    {fixedPlot.householderName
                      ? `（${fixedPlot.householderName} 様）`
                      : '（未契約）'}
                  </p>
                )}
              </FormField>
            </>
          )}

          {mode === 'create' && (
            <FormField
              label="区画"
              required
              error={state.errors?.gravePlotId}
              hint="管理料の台帳を作成する区画を選びます。"
            >
              {(p) => (
                <Select
                  id={p.id}
                  name="gravePlotId"
                  defaultValue={v.gravePlotId ?? ''}
                  aria-invalid={p.invalid}
                  aria-describedby={p.describedBy}
                >
                  <option value="">— 区画を選択 —</option>
                  {(plotOptions ?? []).map((pl) => (
                    <option key={pl.id} value={pl.id}>
                      区画 {pl.plotNumber}
                      {pl.householderName ? `（${pl.householderName} 様）` : '（未契約）'}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
          )}

          <FormField
            label="年額管理料"
            required
            error={state.errors?.annualAmount}
            hint="この区画に賦課する 1 年あたりの管理料 (円)。"
          >
            {(p) => (
              <Input
                id={p.id}
                name="annualAmount"
                inputMode="numeric"
                defaultValue={v.annualAmount ?? dv.annualAmount ?? ''}
                placeholder="例: 12000"
                aria-invalid={p.invalid}
                aria-describedby={p.describedBy}
              />
            )}
          </FormField>

          <FormField label="納入区分" required error={state.errors?.method}>
            {(p) => (
              <Select
                id={p.id}
                name="method"
                defaultValue={v.method ?? dv.method ?? 'BANK_TRANSFER'}
                aria-invalid={p.invalid}
                aria-describedby={p.describedBy}
              >
                {GRAVE_MAINTENANCE_METHOD_ORDER.map((m) => (
                  <option key={m} value={m}>
                    {GRAVE_MAINTENANCE_METHOD_LABELS[m]}
                  </option>
                ))}
              </Select>
            )}
          </FormField>

          <FormField
            label="賦課根拠"
            error={state.errors?.basis}
            hint="面積・区画種別・管理規程など、管理料額の根拠を記録します（任意）。"
          >
            {(p) => (
              <Textarea
                id={p.id}
                name="basis"
                rows={2}
                defaultValue={v.basis ?? dv.basis ?? ''}
                placeholder="例: 一般区画 1 聖地（4 ㎡）・管理規程 第3条"
                aria-invalid={p.invalid}
                aria-describedby={p.describedBy}
              />
            )}
          </FormField>

          <FormField label="備考" error={state.errors?.note}>
            {(p) => (
              <Textarea
                id={p.id}
                name="note"
                rows={2}
                defaultValue={v.note ?? dv.note ?? ''}
                placeholder="例: 減免対象・特記事項 等"
                aria-invalid={p.invalid}
                aria-describedby={p.describedBy}
              />
            )}
          </FormField>

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? '保存中…' : '保存する'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
