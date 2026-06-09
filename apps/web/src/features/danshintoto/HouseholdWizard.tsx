'use client';

import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';
import { Button, buttonVariants, FormField, Input } from '@/components/ui';
import { cn } from '@/lib/utils';
import {
  initialHouseholdFormState,
  type HouseholdFormState,
} from './types';

type Action = (
  prev: HouseholdFormState,
  fd: FormData,
) => Promise<HouseholdFormState>;

type Props = { action: Action; cancelHref: string };

type Step = 1 | 2 | 3;

const STEP_LABELS: { step: Step; label: string }[] = [
  { step: 1, label: 'お名前' },
  { step: 2, label: '連絡先' },
  { step: 3, label: '確認' },
];

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

export function HouseholdWizard({ action, cancelHref }: Props) {
  const [state, formAction, isPending] = useActionState(
    action,
    initialHouseholdFormState,
  );
  const [step, setStep] = useState<Step>(1);

  // 全項目を controlled state にミラーする (確認画面表示・往復時の値保持・「次へ」可否判定)。
  const [householderName, setHouseholderName] = useState(
    state.values?.householderName ?? '',
  );
  const [nameKana, setNameKana] = useState(state.values?.nameKana ?? '');
  const [phone, setPhone] = useState(state.values?.phone ?? '');
  const [mobile, setMobile] = useState(state.values?.mobile ?? '');
  const [email, setEmail] = useState(state.values?.email ?? '');
  const [postalCode, setPostalCode] = useState(state.values?.postalCode ?? '');
  const [address, setAddress] = useState(state.values?.address ?? '');

  // サーバー側バリデーション失敗時、該当 step へ戻す (必須欠落 Step1 を優先)。
  useEffect(() => {
    if (state.status !== 'error') return;
    if (state.errors?.householderName || state.errors?.nameKana) {
      setStep(1);
    } else if (state.errors?.email) {
      setStep(2);
    }
  }, [state]);

  const step1Invalid =
    householderName.trim() === '' || nameKana.trim() === '';

  return (
    <div>
      <ol
        className="flex items-center gap-2"
        aria-label="登録の進み具合"
      >
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

      <form action={formAction} noValidate className="mt-6 space-y-6">
        {/* ===== Step1: お名前 (必須) ===== */}
        <div className={cn('space-y-5', step === 1 ? '' : 'hidden')}>
          <FormField
            label="施主名"
            required
            error={state.errors?.householderName}
          >
            {(p) => (
              <Input
                id={p.id}
                name="householderName"
                value={householderName}
                onChange={(e) => setHouseholderName(e.target.value)}
                placeholder="例: 山田 太郎"
                autoComplete="off"
                aria-invalid={p.invalid}
                aria-describedby={p.describedBy}
              />
            )}
          </FormField>
          <FormField
            label="ふりがな (検索用)"
            required
            error={state.errors?.nameKana}
          >
            {(p) => (
              <Input
                id={p.id}
                name="nameKana"
                value={nameKana}
                onChange={(e) => setNameKana(e.target.value)}
                placeholder="例: やまだ たろう"
                autoComplete="off"
                aria-invalid={p.invalid}
                aria-describedby={p.describedBy}
              />
            )}
          </FormField>
        </div>

        {/* ===== Step2: 連絡先 (任意) ===== */}
        <div className={cn('space-y-5', step === 2 ? '' : 'hidden')}>
          <p className="text-sm text-muted-foreground">
            連絡先は任意です。後からカルテ詳細でも追記・修正できます。
          </p>
          <FormField label="電話">
            {(p) => (
              <Input
                id={p.id}
                name="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="例: 03-1234-5678"
                autoComplete="tel"
                aria-describedby={p.describedBy}
              />
            )}
          </FormField>
          <FormField label="携帯電話">
            {(p) => (
              <Input
                id={p.id}
                name="mobile"
                type="tel"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="例: 090-1234-5678"
                autoComplete="tel"
                aria-describedby={p.describedBy}
              />
            )}
          </FormField>
          <FormField label="メール" error={state.errors?.email}>
            {(p) => (
              <Input
                id={p.id}
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="例: taro@example.com"
                autoComplete="email"
                aria-invalid={p.invalid}
                aria-describedby={p.describedBy}
              />
            )}
          </FormField>
          <FormField label="郵便番号">
            {(p) => (
              <Input
                id={p.id}
                name="postalCode"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="例: 123-4567"
                autoComplete="postal-code"
                aria-describedby={p.describedBy}
              />
            )}
          </FormField>
          <FormField label="住所">
            {(p) => (
              <Input
                id={p.id}
                name="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="例: 東京都○○区○○ 1-2-3"
                autoComplete="street-address"
                aria-describedby={p.describedBy}
              />
            )}
          </FormField>
        </div>

        {/* ===== Step3: 確認 ===== */}
        <div className={cn('space-y-4', step === 3 ? '' : 'hidden')}>
          <p className="text-base text-foreground">
            この内容で登録します。よろしければ「登録する」を押してください。
          </p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 rounded border border-border bg-muted/40 p-4">
            <ConfirmRow label="施主名" value={householderName} />
            <ConfirmRow label="ふりがな" value={nameKana} />
            <ConfirmRow label="電話" value={phone} />
            <ConfirmRow label="携帯電話" value={mobile} />
            <ConfirmRow label="メール" value={email} />
            <ConfirmRow label="郵便番号" value={postalCode} />
            <ConfirmRow label="住所" value={address} />
          </dl>
        </div>

        {/* ===== フッターのナビ ===== */}
        <div className="flex items-center justify-between gap-3 pt-2">
          {step === 1 ? (
            <Link
              href={cancelHref}
              className={buttonVariants({ variant: 'secondary', size: 'lg' })}
            >
              キャンセル
            </Link>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={() => setStep((s) => (s === 3 ? 2 : 1))}
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
            <Button type="submit" size="lg" disabled={isPending}>
              {isPending ? '登録中…' : '登録する'}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
