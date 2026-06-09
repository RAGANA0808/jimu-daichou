'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import {
  Button,
  buttonVariants,
  Card,
  CardContent,
  FormField,
  Input,
  Select,
  VoiceTextarea,
} from '@/components/ui';
import { KAIKI_NAMES, MEMORIAL_CUTOFF_OPTIONS } from '@/lib/nenki';
import {
  initialDeathLedgerFormState,
  type DeathLedgerFieldName,
  type DeathLedgerFormState,
} from './types';

type DeathLedgerAction = (
  prev: DeathLedgerFormState,
  formData: FormData,
) => Promise<DeathLedgerFormState>;

type Props = {
  action: DeathLedgerAction;
  submitLabel: string;
  cancelHref: string;
  initialValues?: Partial<Record<DeathLedgerFieldName, string>>;
  /** 新規登録時に hidden で送信する世帯 ID */
  householdId?: string;
  /** 編集時に hidden で送信するエントリ ID */
  entryId?: string;
  /** M-5 楽観ロックトークン (編集時のみ)。hidden input として送出される。 */
  expectedUpdatedAt?: string;
};

export function DeathLedgerEntryForm({
  action,
  submitLabel,
  cancelHref,
  initialValues,
  householdId,
  entryId,
  expectedUpdatedAt,
}: Props) {
  const [state, formAction, isPending] = useActionState(
    action,
    initialDeathLedgerFormState,
  );

  const iv = initialValues ?? {};
  const v = (name: DeathLedgerFieldName): string =>
    state.values?.[name] ?? iv[name] ?? '';
  const err = (name: DeathLedgerFieldName): string | undefined =>
    state.errors?.[name];
  const warning = state.duplicateWarning;

  return (
    <form action={formAction} noValidate className="space-y-5">
      {householdId && (
        <input type="hidden" name="householdId" value={householdId} />
      )}
      {entryId && <input type="hidden" name="entryId" value={entryId} />}
      {expectedUpdatedAt && (
        <input
          type="hidden"
          name="expectedUpdatedAt"
          value={expectedUpdatedAt}
        />
      )}

      {state.formError && (
        <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.formError}
        </p>
      )}
      {/* 重複警告が出ている状態でそのまま再送信したら登録を続行する */}
      {warning && <input type="hidden" name="confirmDuplicate" value="true" />}

      {warning && (
        <Card className="border-warning/40 bg-warning-soft">
          <CardContent className="space-y-2 py-4">
            <p className="font-medium text-warning">
              同じ世帯に同名の故人が登録されています
            </p>
            <ul className="list-disc pl-5 text-sm text-foreground">
              {warning.names.map((n, i) => (
                <li key={`${n}-${i}`}>{n}</li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground">
              重複でなければ、このまま「{submitLabel}」を押すと登録を続行します。
            </p>
          </CardContent>
        </Card>
      )}

      <FormField label="俗名" required error={err('secularName')}>
        {(p) => (
          <Input
            id={p.id}
            name="secularName"
            defaultValue={v('secularName')}
            placeholder="例: 山田 一郎"
            aria-invalid={p.invalid}
            aria-describedby={p.describedBy}
          />
        )}
      </FormField>

      <FormField label="ふりがな" required error={err('nameKana')}>
        {(p) => (
          <Input
            id={p.id}
            name="nameKana"
            defaultValue={v('nameKana')}
            placeholder="例: やまだ いちろう"
            aria-invalid={p.invalid}
            aria-describedby={p.describedBy}
          />
        )}
      </FormField>

      <FormField label="戒名" error={err('kaimyoName')}>
        {(p) => (
          <Input
            id={p.id}
            name="kaimyoName"
            defaultValue={v('kaimyoName')}
            placeholder="例: 釈○○"
            aria-invalid={p.invalid}
            aria-describedby={p.describedBy}
          />
        )}
      </FormField>

      <fieldset className="space-y-3">
        <legend className="text-base font-medium text-foreground">没年月日</legend>
        <p className="text-sm text-muted-foreground">
          判明している範囲でご入力ください。月日が不明な場合は空欄のまま登録できます
          （年のみ・年月のみも可）。明治以前の故人も登録できます。
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <FormField label="没年（西暦）" error={err('deathYear')}>
            {(p) => (
              <Input
                id={p.id}
                name="deathYear"
                type="number"
                inputMode="numeric"
                defaultValue={v('deathYear')}
                placeholder="例: 1985"
                aria-invalid={p.invalid}
                aria-describedby={p.describedBy}
              />
            )}
          </FormField>
          <FormField label="没月" error={err('deathMonth')}>
            {(p) => (
              <Input
                id={p.id}
                name="deathMonth"
                type="number"
                inputMode="numeric"
                min="1"
                max="12"
                defaultValue={v('deathMonth')}
                placeholder="例: 3"
                aria-invalid={p.invalid}
                aria-describedby={p.describedBy}
              />
            )}
          </FormField>
          <FormField label="没日" error={err('deathDay')}>
            {(p) => (
              <Input
                id={p.id}
                name="deathDay"
                type="number"
                inputMode="numeric"
                min="1"
                max="31"
                defaultValue={v('deathDay')}
                placeholder="例: 15"
                aria-invalid={p.invalid}
                aria-describedby={p.describedBy}
              />
            )}
          </FormField>
        </div>
      </fieldset>

      <FormField label="行年" error={err('ageAtDeath')}>
        {(p) => (
          <Input
            id={p.id}
            name="ageAtDeath"
            type="number"
            inputMode="numeric"
            defaultValue={v('ageAtDeath')}
            placeholder="例: 85"
            aria-invalid={p.invalid}
            aria-describedby={p.describedBy}
            className="sm:max-w-[160px]"
          />
        )}
      </FormField>

      <FormField label="続柄" error={err('familyRelation')}>
        {(p) => (
          <Input
            id={p.id}
            name="familyRelation"
            defaultValue={v('familyRelation')}
            placeholder="例: 先代 / 父 / 母"
            aria-invalid={p.invalid}
            aria-describedby={p.describedBy}
          />
        )}
      </FormField>

      <FormField label="埋葬場所" error={err('burialLocation')}>
        {(p) => (
          <Input
            id={p.id}
            name="burialLocation"
            defaultValue={v('burialLocation')}
            placeholder="例: ○○霊園"
            aria-invalid={p.invalid}
            aria-describedby={p.describedBy}
          />
        )}
      </FormField>

      <FormField
        label="弔い上げ回忌"
        error={err('memorialCutoffAnniversary')}
        hint="設定すると、この回忌で年忌を終え、以降は年忌表・ご案内の対象から外れます。未設定の場合は五十回忌まで続きます。"
      >
        {(p) => (
          <Select
            id={p.id}
            name="memorialCutoffAnniversary"
            defaultValue={v('memorialCutoffAnniversary')}
            aria-invalid={p.invalid}
            aria-describedby={p.describedBy}
          >
            <option value="">既定（五十回忌まで）</option>
            {MEMORIAL_CUTOFF_OPTIONS.map((kaiki) => (
              <option key={kaiki} value={kaiki}>
                {KAIKI_NAMES[kaiki]}で弔い上げ
              </option>
            ))}
          </Select>
        )}
      </FormField>

      <FormField label="備考メモ" error={err('memo')}>
        {(p) => (
          <VoiceTextarea
            id={p.id}
            name="memo"
            rows={3}
            defaultValue={v('memo')}
            aria-invalid={p.invalid}
            aria-describedby={p.describedBy}
            voiceFieldLabel="備考メモ"
          />
        )}
      </FormField>

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? '保存中…' : submitLabel}
        </Button>
        <Link href={cancelHref} className={buttonVariants({ variant: 'secondary' })}>
          キャンセル
        </Link>
      </div>
    </form>
  );
}
