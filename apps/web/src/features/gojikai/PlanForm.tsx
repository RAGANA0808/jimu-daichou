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
  MAINTENANCE_FEE_METHOD_LABELS,
  MAINTENANCE_FEE_METHOD_ORDER,
} from '@/lib/gojikai';
import { saveFeePlanAction } from './actions';
import { initialPlanFormState } from './types';

type HouseholdOption = {
  id: string;
  householderName: string;
  nameKana: string;
};

type Props = {
  /** 新規: 選択式の世帯候補。編集: 単一の固定世帯。 */
  mode: 'create' | 'edit';
  householdOptions?: HouseholdOption[];
  fixedHousehold?: { id: string; householderName: string };
  defaultValues?: {
    annualAmount?: string;
    method?: string;
    note?: string;
  };
};

export function PlanForm({
  mode,
  householdOptions,
  fixedHousehold,
  defaultValues,
}: Props) {
  const [state, formAction, isPending] = useActionState(
    saveFeePlanAction,
    initialPlanFormState,
  );

  // 値の優先順位: サーバ再描画 (エラー時の echo) > 編集時の初期値 > 空。
  // householdId はエラー echo (state.values) からのみ来る。
  const v = state.values ?? {};
  const dv = defaultValues ?? {};

  return (
    <Card>
      <CardContent className="py-6">
        <form action={formAction} noValidate className="space-y-5">
          {mode === 'edit' && fixedHousehold && (
            <>
              <input type="hidden" name="householdId" value={fixedHousehold.id} />
              <FormField label="世帯">
                {() => (
                  <p className="text-base text-foreground">
                    {fixedHousehold.householderName} 様
                  </p>
                )}
              </FormField>
            </>
          )}

          {mode === 'create' && (
            <FormField
              label="世帯"
              required
              error={state.errors?.householdId}
              hint="護持会費の台帳を作成する世帯を選びます。"
            >
              {(p) => (
                <Select
                  id={p.id}
                  name="householdId"
                  defaultValue={v.householdId ?? ''}
                  aria-invalid={p.invalid}
                  aria-describedby={p.describedBy}
                >
                  <option value="">— 世帯を選択 —</option>
                  {(householdOptions ?? []).map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.householderName}（{h.nameKana}）
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
          )}

          <FormField
            label="年額会費"
            required
            error={state.errors?.annualAmount}
            hint="この世帯に賦課する 1 年あたりの護持会費 (円)。"
          >
            {(p) => (
              <Input
                id={p.id}
                name="annualAmount"
                inputMode="numeric"
                defaultValue={v.annualAmount ?? dv.annualAmount ?? ''}
                placeholder="例: 10000"
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
                defaultValue={v.method ?? dv.method ?? 'CASH_COLLECTION'}
                aria-invalid={p.invalid}
                aria-describedby={p.describedBy}
              >
                {MAINTENANCE_FEE_METHOD_ORDER.map((m) => (
                  <option key={m} value={m}>
                    {MAINTENANCE_FEE_METHOD_LABELS[m]}
                  </option>
                ))}
              </Select>
            )}
          </FormField>

          <FormField label="備考" error={state.errors?.note}>
            {(p) => (
              <Textarea
                id={p.id}
                name="note"
                rows={3}
                defaultValue={v.note ?? dv.note ?? ''}
                placeholder="例: 本家世帯・賦課額の根拠 等"
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
