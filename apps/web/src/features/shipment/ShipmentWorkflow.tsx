'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  FormField,
  Input,
  Select,
  Textarea,
  useToast,
} from '@/components/ui';
import { LABEL_SHEET_SPECS, DEFAULT_LABEL_SHEET_ID } from '@/lib/shipment';
import { recordShipmentAction } from './actions';
import { initialShipmentFormState } from './types';
import type { ShipmentRecipientCandidate } from './queries';

type Props = {
  year: number;
  candidates: ShipmentRecipientCandidate[];
};

const inputDateTimeClass =
  'block min-h-touch w-full rounded border border-border bg-surface px-3 py-2 text-base text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-info aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger';

export function ShipmentWorkflow({ year, candidates }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [state, formAction, isPending] = useActionState(
    recordShipmentAction,
    initialShipmentFormState,
  );

  const [title, setTitle] = useState(`${year}年 年忌法要のご案内`);
  const [documentType, setDocumentType] = useState('NOTICE_LETTER');
  const [serviceDate, setServiceDate] = useState('');
  const [location, setLocation] = useState('');
  const [offeringGuide, setOfferingGuide] = useState('');
  const [replyDeadline, setReplyDeadline] = useState('');
  const [bodyNote, setBodyNote] = useState('');
  const [labelSheet, setLabelSheet] = useState(DEFAULT_LABEL_SHEET_ID);

  const missingAddressCount = candidates.filter((c) => c.missingAddress).length;
  const duplicateCount = candidates.filter(
    (c) => c.duplicateState === 'all',
  ).length;

  // 送付対象チェックの初期状態: 既送 (全既送) はデフォルト OFF、それ以外は ON。
  const [included, setIncluded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      candidates.map((c) => [c.householdId, c.duplicateState !== 'all']),
    ),
  );

  function toggleIncluded(householdId: string): void {
    setIncluded((prev) => ({ ...prev, [householdId]: !prev[householdId] }));
  }

  const includedCount = candidates.filter(
    (c) => included[c.householdId],
  ).length;

  useEffect(() => {
    if (state.status === 'success' && state.createdBatchId) {
      toast({
        title: '発送を記録しました',
        description: 'カルテの対応履歴にも反映しました。',
        variant: 'success',
      });
      router.push(`/hasso/${state.createdBatchId}`);
    } else if (state.status === 'error' && state.formError) {
      toast({ title: state.formError, variant: 'danger' });
    }
  }, [state, toast, router]);

  /** 現在のフォーム入力を差込パラメータとして PDF/CSV ルートへ渡す。 */
  function outputUrl(path: string, extra: Record<string, string> = {}): string {
    const sp = new URLSearchParams({ year: String(year), ...extra });
    if (serviceDate) sp.set('serviceDate', serviceDate);
    if (location) sp.set('location', location);
    if (offeringGuide) sp.set('offeringGuide', offeringGuide);
    if (replyDeadline) sp.set('replyDeadline', replyDeadline);
    if (bodyNote) sp.set('bodyNote', bodyNote);
    return `${path}?${sp.toString()}`;
  }

  return (
    <div className="space-y-6">
      {/* ステップ 1: 対象の確認 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground">
              1
            </span>
            発送対象の確認（{year} 年）
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-base">
            <Badge variant="info">{candidates.length} 世帯</Badge>
            {missingAddressCount > 0 && (
              <Badge variant="warning">
                住所未登録 {missingAddressCount} 世帯
              </Badge>
            )}
            {duplicateCount > 0 && (
              <Badge variant="warning">既送 {duplicateCount} 世帯</Badge>
            )}
            <span className="text-sm text-muted-foreground">
              弔い上げ済み・離檀された世帯は除いています。
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            同じ対象・回忌に既に案内済みの世帯には「既送」を表示しています。重複送付を避けたい場合はチェックを外してください。
            ※重複チェックは本機能導入後の発送記録が対象です。
          </p>

          {/* PC: テーブル / スマホ: カード */}
          <div className="hidden md:block">
            <div className="w-full overflow-x-auto rounded-lg border border-border">
              <table className="w-full border-collapse text-base">
                <thead className="bg-brand text-brand-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-brand-foreground">
                      送付
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-brand-foreground">
                      宛名（施主）
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-brand-foreground">
                      住所
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-brand-foreground">
                      対象の故人・年忌
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-brand-foreground">
                      状態
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {candidates.map((c) => (
                    <tr key={c.householdId} className="bg-surface">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={included[c.householdId] ?? false}
                          onChange={() => toggleIncluded(c.householdId)}
                          aria-label={`${c.householderName} を送付対象に含める`}
                          className="h-5 w-5 rounded border-border accent-brand"
                        />
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {c.householderName} 様
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {c.address ? (
                          <span>
                            {c.postalCode && (
                              <span className="text-sm text-muted-foreground">
                                〒{c.postalCode}{' '}
                              </span>
                            )}
                            {c.address}
                          </span>
                        ) : (
                          <Badge variant="warning">住所未登録</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-foreground">{c.summary}</td>
                      <td className="px-4 py-3">
                        {c.duplicateState === 'all' ? (
                          <Badge variant="warning">既送（重複）</Badge>
                        ) : c.duplicateState === 'partial' ? (
                          <Badge variant="info">一部既送</Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <ul className="space-y-2 md:hidden">
            {candidates.map((c) => (
              <li
                key={c.householdId}
                className="rounded-lg border border-border bg-surface p-3"
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={included[c.householdId] ?? false}
                    onChange={() => toggleIncluded(c.householdId)}
                    aria-label={`${c.householderName} を送付対象に含める`}
                    className="mt-1 h-5 w-5 rounded border-border accent-brand"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">
                        {c.householderName} 様
                      </span>
                      {c.duplicateState === 'all' && (
                        <Badge variant="warning">既送（重複）</Badge>
                      )}
                      {c.duplicateState === 'partial' && (
                        <Badge variant="info">一部既送</Badge>
                      )}
                    </div>
                    <div className="mt-1 text-sm text-foreground">{c.summary}</div>
                    <div className="mt-1 text-sm">
                      {c.address ? (
                        <span className="text-muted-foreground">
                          {c.postalCode && `〒${c.postalCode} `}
                          {c.address}
                        </span>
                      ) : (
                        <Badge variant="warning">住所未登録</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* ステップ 2: 案内内容の差込 + 出力 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground">
              2
            </span>
            案内内容の差し込みと出力
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={formAction} noValidate className="space-y-5">
            <input type="hidden" name="targetYear" value={year} />
            {/* 送付対象に含める世帯 ID (A-2)。サーバは再抽出結果と突合し、含める意思のみ尊重する。 */}
            {candidates
              .filter((c) => included[c.householdId])
              .map((c) => (
                <input
                  key={c.householdId}
                  type="hidden"
                  name="includeHouseholdId"
                  value={c.householdId}
                />
              ))}

            <FormField label="発送名" required error={state.errors?.title}>
              {(p) => (
                <Input
                  id={p.id}
                  name="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  aria-invalid={p.invalid}
                  aria-describedby={p.describedBy}
                />
              )}
            </FormField>

            <FormField
              label="発送物の種別"
              required
              error={state.errors?.documentType}
              hint="出力する帳票の種類です。記録にも残ります。"
            >
              {(p) => (
                <Select
                  id={p.id}
                  name="documentType"
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  aria-invalid={p.invalid}
                  aria-describedby={p.describedBy}
                >
                  <option value="NOTICE_LETTER">案内状</option>
                  <option value="ADDRESS_LABEL">宛名ラベル</option>
                  <option value="ENVELOPE">封筒宛名</option>
                  <option value="CSV">宛名 CSV</option>
                </Select>
              )}
            </FormField>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="法要日時" error={state.errors?.serviceDate}>
                {(p) => (
                  <input
                    id={p.id}
                    name="serviceDate"
                    type="datetime-local"
                    value={serviceDate}
                    onChange={(e) => setServiceDate(e.target.value)}
                    aria-invalid={p.invalid}
                    aria-describedby={p.describedBy}
                    className={inputDateTimeClass}
                  />
                )}
              </FormField>

              <FormField label="返信締切" error={state.errors?.replyDeadline}>
                {(p) => (
                  <input
                    id={p.id}
                    name="replyDeadline"
                    type="date"
                    value={replyDeadline}
                    onChange={(e) => setReplyDeadline(e.target.value)}
                    aria-invalid={p.invalid}
                    aria-describedby={p.describedBy}
                    className={inputDateTimeClass}
                  />
                )}
              </FormField>
            </div>

            <FormField label="場所" error={state.errors?.location}>
              {(p) => (
                <Input
                  id={p.id}
                  name="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="例: 本堂"
                  aria-invalid={p.invalid}
                  aria-describedby={p.describedBy}
                />
              )}
            </FormField>

            <FormField
              label="お布施の目安"
              error={state.errors?.offeringGuide}
              hint="案内状に記載されます。空欄なら記載しません。"
            >
              {(p) => (
                <Input
                  id={p.id}
                  name="offeringGuide"
                  value={offeringGuide}
                  onChange={(e) => setOfferingGuide(e.target.value)}
                  placeholder="例: 三万円程度"
                  aria-invalid={p.invalid}
                  aria-describedby={p.describedBy}
                />
              )}
            </FormField>

            <FormField label="本文への追記" error={state.errors?.bodyNote}>
              {(p) => (
                <Textarea
                  id={p.id}
                  name="bodyNote"
                  rows={3}
                  value={bodyNote}
                  onChange={(e) => setBodyNote(e.target.value)}
                  placeholder="例: 当日は法要後にお斎をご用意しております。"
                  aria-invalid={p.invalid}
                  aria-describedby={p.describedBy}
                />
              )}
            </FormField>

            {/* 帳票出力 (記録の前にプレビュー/印刷できる) */}
            <div className="rounded-lg border border-border bg-muted/40 p-4">
              <p className="mb-3 text-sm font-medium text-foreground">
                帳票を出力（別タブで開きます）
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={outputUrl('/api/shipment/pdf', { type: 'notice' })}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button type="button" variant="secondary" size="sm">
                    案内状 PDF
                  </Button>
                </a>
                <a
                  href={outputUrl('/api/shipment/pdf', {
                    type: 'label',
                    sheet: labelSheet,
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button type="button" variant="secondary" size="sm">
                    宛名ラベル PDF
                  </Button>
                </a>
                <select
                  value={labelSheet}
                  onChange={(e) => setLabelSheet(e.target.value)}
                  aria-label="ラベル規格"
                  className="min-h-touch rounded border border-border bg-surface px-2 py-1 text-sm"
                >
                  {LABEL_SHEET_SPECS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <a
                  href={outputUrl('/api/shipment/pdf', { type: 'envelope' })}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button type="button" variant="secondary" size="sm">
                    封筒宛名 PDF
                  </Button>
                </a>
                <a href={outputUrl('/api/shipment/csv')}>
                  <Button type="button" variant="secondary" size="sm">
                    宛名 CSV
                  </Button>
                </a>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                差し込んだ日時・場所・お布施・締切は案内状 PDF に反映されます。
              </p>
            </div>

            {/* ステップ 3: 送信前確認つきの記録 (特許回避: 手動トリガ) */}
            <div className="border-t border-border pt-4">
              <p className="mb-3 text-sm text-muted-foreground">
                帳票を印刷・発送したら、下のボタンで発送を記録します。
                記録すると各世帯のカルテにも履歴が残ります。
              </p>
              <Button
                type="submit"
                size="lg"
                disabled={isPending || includedCount === 0}
              >
                {isPending
                  ? '記録中…'
                  : `この内容で発送を記録する（${includedCount} 世帯）`}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
