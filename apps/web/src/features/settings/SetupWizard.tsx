'use client';

import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';
import { Button, buttonVariants, FormField, Input, Select } from '@/components/ui';
import { SECT_OPTIONS } from '@/lib/nenki';
import { cn } from '@/lib/utils';
import { completeTenantSetupAction } from './actions';
import { initialSetupFormState, type SetupFieldName } from './types';

type Step = 1 | 2 | 3 | 4;

const STEP_LABELS: { step: Step; label: string }[] = [
  { step: 1, label: '寺院情報' },
  { step: 2, label: '郵便口座' },
  { step: 3, label: '初期科目' },
  { step: 4, label: '確認' },
];

const PRESET_SUBJECTS = ['護持会費', 'お布施', '寄付'] as const;

type InitialValues = Record<SetupFieldName, string>;

function ConfirmRow({ label, value }: { label: string; value: string }) {
  const v = value.trim();
  return (
    <>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-base text-foreground">
        {v.length > 0 ? v : <span className="text-muted-foreground">—</span>}
      </dd>
    </>
  );
}

export function SetupWizard({ initialValues }: { initialValues: InitialValues }) {
  const [state, formAction, isPending] = useActionState(
    completeTenantSetupAction,
    initialSetupFormState,
  );
  const [step, setStep] = useState<Step>(1);

  // 全項目を controlled state にミラー (確認画面表示・往復時の値保持・「次へ」可否判定)。
  const [name, setName] = useState(state.values?.name ?? initialValues.name);
  const [headPriestName, setHeadPriestName] = useState(
    state.values?.headPriestName ?? initialValues.headPriestName,
  );
  const [sect, setSect] = useState(state.values?.sect ?? initialValues.sect);
  const [postalAccountName, setPostalAccountName] = useState(
    state.values?.postalAccountName ?? initialValues.postalAccountName,
  );
  const [postalAccountSymbol, setPostalAccountSymbol] = useState(
    state.values?.postalAccountSymbol ?? initialValues.postalAccountSymbol,
  );
  const [postalAccountNumber, setPostalAccountNumber] = useState(
    state.values?.postalAccountNumber ?? initialValues.postalAccountNumber,
  );
  const [postalTransferNote, setPostalTransferNote] = useState(
    state.values?.postalTransferNote ?? initialValues.postalTransferNote,
  );
  const [presetSubjects, setPresetSubjects] = useState<Set<string>>(
    () => new Set(PRESET_SUBJECTS),
  );

  // サーバー側バリデーション失敗時、該当 step へ戻す。
  useEffect(() => {
    if (state.status !== 'error') return;
    if (state.errors?.name || state.errors?.headPriestName || state.errors?.sect) {
      setStep(1);
    } else if (
      state.errors?.postalAccountName ||
      state.errors?.postalAccountSymbol ||
      state.errors?.postalAccountNumber ||
      state.errors?.postalTransferNote
    ) {
      setStep(2);
    }
  }, [state]);

  const step1Invalid = name.trim() === '';

  function togglePreset(value: string, checked: boolean) {
    setPresetSubjects((prev) => {
      const next = new Set(prev);
      if (checked) next.add(value);
      else next.delete(value);
      return next;
    });
  }

  const sectLabel =
    SECT_OPTIONS.find((o) => o.value === sect)?.label ?? '未設定（標準）';
  const selectedSubjectLabel =
    PRESET_SUBJECTS.filter((s) => presetSubjects.has(s)).join('、') || 'なし';

  return (
    <div>
      <ol className="flex flex-wrap items-center gap-2" aria-label="初期設定の進み具合">
        {STEP_LABELS.map(({ step: s, label }) => {
          const isCurrent = s === step;
          const isDone = s < step;
          return (
            <li
              key={s}
              aria-current={isCurrent ? 'step' : undefined}
              className={cn(
                'flex items-center gap-2 rounded-full px-3 py-1.5 text-sm',
                isCurrent || isDone
                  ? 'bg-brand text-brand-foreground'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              <span className="font-medium">{s}</span>
              {label}
            </li>
          );
        })}
      </ol>

      {state.formError && (
        <p
          role="alert"
          className="mt-4 rounded bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {state.formError}
        </p>
      )}

      <form action={formAction} noValidate className="mt-6 space-y-6">
        {/* ===== Step1: 寺院情報 ===== */}
        <div className={cn('space-y-5', step === 1 ? '' : 'hidden')}>
          <p className="text-sm text-muted-foreground">
            まずは寺院の基本情報を確認します。
          </p>
          <FormField label="寺院名" required error={state.errors?.name}>
            {(p) => (
              <Input
                id={p.id}
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例: 芳全寺"
                autoComplete="off"
                aria-invalid={p.invalid}
                aria-describedby={p.describedBy}
              />
            )}
          </FormField>
          <FormField label="住職氏名" error={state.errors?.headPriestName}>
            {(p) => (
              <Input
                id={p.id}
                name="headPriestName"
                value={headPriestName}
                onChange={(e) => setHeadPriestName(e.target.value)}
                placeholder="例: 山田 太郎"
                autoComplete="off"
                aria-invalid={p.invalid}
                aria-describedby={p.describedBy}
              />
            )}
          </FormField>
          <FormField
            label="宗派"
            error={state.errors?.sect}
            hint="未設定の場合は五十回忌までの標準スケジュールで表示します。浄土真宗系は三十三回忌を目安に表示します（故人ごとの設定が優先されます）。"
          >
            {(p) => (
              <Select
                id={p.id}
                name="sect"
                value={sect}
                onChange={(e) => setSect(e.target.value)}
                aria-invalid={p.invalid}
                aria-describedby={p.describedBy}
              >
                <option value="">未設定（標準スケジュール）</option>
                {SECT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
        </div>

        {/* ===== Step2: 郵便振替口座 ===== */}
        <div className={cn('space-y-5', step === 2 ? '' : 'hidden')}>
          <p className="text-sm text-muted-foreground">
            払込取扱票へ印字する寺の口座情報です。すべて任意で、あとから設定画面でも変更できます。
          </p>
          <FormField label="加入者名" error={state.errors?.postalAccountName}>
            {(p) => (
              <Input
                id={p.id}
                name="postalAccountName"
                value={postalAccountName}
                onChange={(e) => setPostalAccountName(e.target.value)}
                placeholder="例: 芳全寺"
                autoComplete="off"
                aria-invalid={p.invalid}
                aria-describedby={p.describedBy}
              />
            )}
          </FormField>
          <FormField label="口座記号" error={state.errors?.postalAccountSymbol}>
            {(p) => (
              <Input
                id={p.id}
                name="postalAccountSymbol"
                value={postalAccountSymbol}
                onChange={(e) => setPostalAccountSymbol(e.target.value)}
                placeholder="例: 00100"
                autoComplete="off"
                aria-invalid={p.invalid}
                aria-describedby={p.describedBy}
              />
            )}
          </FormField>
          <FormField label="口座番号" error={state.errors?.postalAccountNumber}>
            {(p) => (
              <Input
                id={p.id}
                name="postalAccountNumber"
                value={postalAccountNumber}
                onChange={(e) => setPostalAccountNumber(e.target.value)}
                placeholder="例: 1234567"
                autoComplete="off"
                aria-invalid={p.invalid}
                aria-describedby={p.describedBy}
              />
            )}
          </FormField>
          <FormField
            label="通信欄の既定文"
            error={state.errors?.postalTransferNote}
          >
            {(p) => (
              <Input
                id={p.id}
                name="postalTransferNote"
                value={postalTransferNote}
                onChange={(e) => setPostalTransferNote(e.target.value)}
                placeholder="例: 護持会費 年間"
                autoComplete="off"
                aria-invalid={p.invalid}
                aria-describedby={p.describedBy}
              />
            )}
          </FormField>
        </div>

        {/* ===== Step3: 初期科目テンプレ ===== */}
        <div className={cn('space-y-4', step === 3 ? '' : 'hidden')}>
          <p className="text-sm text-muted-foreground">
            郵便振替で使う科目をあらかじめ用意できます（任意）。チェックした科目を作成します。すでに同名の科目があれば重複作成しません。
          </p>
          <div className="space-y-3">
            {PRESET_SUBJECTS.map((subject) => (
              <label
                key={subject}
                className="flex items-center gap-3 rounded border border-border px-4 py-3 text-base text-foreground"
              >
                <input
                  type="checkbox"
                  name="presetSubjects"
                  value={subject}
                  checked={presetSubjects.has(subject)}
                  onChange={(e) => togglePreset(subject, e.target.checked)}
                  className="h-5 w-5 rounded border-border text-brand focus:ring-brand"
                />
                {subject}
              </label>
            ))}
          </div>
        </div>

        {/* ===== Step4: 確認・完了 ===== */}
        <div className={cn('space-y-4', step === 4 ? '' : 'hidden')}>
          <p className="text-base text-foreground">
            この内容で初期設定を保存します。よろしければ「初期設定を完了する」を押してください。
          </p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 rounded border border-border bg-muted/40 p-4">
            <ConfirmRow label="寺院名" value={name} />
            <ConfirmRow label="住職氏名" value={headPriestName} />
            <ConfirmRow label="宗派" value={sectLabel} />
            <ConfirmRow label="加入者名" value={postalAccountName} />
            <ConfirmRow label="口座記号" value={postalAccountSymbol} />
            <ConfirmRow label="口座番号" value={postalAccountNumber} />
            <ConfirmRow label="通信欄の既定文" value={postalTransferNote} />
            <ConfirmRow label="作成する科目" value={selectedSubjectLabel} />
          </dl>
        </div>

        {/* ===== フッターのナビ ===== */}
        <div className="flex items-center justify-between gap-3 pt-2">
          {step === 1 ? (
            <Link
              href="/settings"
              className={buttonVariants({ variant: 'secondary', size: 'lg' })}
            >
              キャンセル
            </Link>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : s))}
            >
              戻る
            </Button>
          )}

          {step === 1 && (
            <Button
              type="button"
              size="lg"
              disabled={step1Invalid}
              onClick={() => setStep(2)}
            >
              次へ
            </Button>
          )}
          {step === 2 && (
            <Button type="button" size="lg" onClick={() => setStep(3)}>
              次へ
            </Button>
          )}
          {step === 3 && (
            <Button type="button" size="lg" onClick={() => setStep(4)}>
              次へ
            </Button>
          )}
          {step === 4 && (
            <Button type="submit" size="lg" disabled={isPending}>
              {isPending ? '保存中…' : '初期設定を完了する'}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
