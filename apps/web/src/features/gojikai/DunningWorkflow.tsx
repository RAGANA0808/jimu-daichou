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
  Textarea,
  useToast,
} from '@/components/ui';
import { recordDunningShipmentAction } from './actions';
import { initialDunningRecordState } from './types';
import { formatYen } from './format';
import type { DunningCandidate } from './queries';

type Props = {
  fiscalYear: number;
  candidates: DunningCandidate[];
};

/**
 * 未納世帯の確認 → 督促状 PDF 出力 → 発送記録 の手動ワークフロー (特許回避)。
 */
export function DunningWorkflow({ fiscalYear, candidates }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [state, formAction, isPending] = useActionState(
    recordDunningShipmentAction,
    initialDunningRecordState,
  );

  const [dueNote, setDueNote] = useState('');
  const [bodyNote, setBodyNote] = useState('');

  const missingAddressCount = candidates.filter((c) => c.missingAddress).length;
  const totalOutstanding = candidates.reduce((s, c) => s + c.outstanding, 0);

  useEffect(() => {
    if (state.status === 'success' && state.createdBatchId) {
      toast({
        title: '督促状の発送を記録しました',
        description: '各世帯のカルテにも履歴を残しました。',
        variant: 'success',
      });
      router.push(`/hasso/${state.createdBatchId}`);
    } else if (state.status === 'error' && state.formError) {
      toast({ title: state.formError, variant: 'danger' });
    }
  }, [state, toast, router]);

  function pdfUrl(): string {
    const sp = new URLSearchParams({ year: String(fiscalYear) });
    if (dueNote.trim()) sp.set('dueNote', dueNote.trim());
    if (bodyNote.trim()) sp.set('bodyNote', bodyNote.trim());
    return `/api/gojikai/dunning?${sp.toString()}`;
  }

  return (
    <div className="space-y-6">
      {/* ステップ 1: 未集金世帯の確認 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground">
              1
            </span>
            未集金世帯の確認（{fiscalYear} 年度）
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-base">
            <Badge variant="danger">{candidates.length} 世帯</Badge>
            <span className="text-foreground">
              未納合計 {formatYen(totalOutstanding)}
            </span>
            {missingAddressCount > 0 && (
              <Badge variant="warning">
                住所未登録 {missingAddressCount} 世帯
              </Badge>
            )}
          </div>

          {/* PC: テーブル */}
          <div className="hidden md:block">
            <div className="w-full overflow-x-auto rounded-lg border border-border">
              <table className="w-full border-collapse text-base">
                <thead className="bg-brand text-brand-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-brand-foreground">
                      宛名（施主）
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-brand-foreground">
                      住所
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-muted-foreground">
                      未納額
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {candidates.map((c) => (
                    <tr key={c.householdId} className="bg-surface">
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
                      <td className="px-4 py-3 text-right text-foreground">
                        {formatYen(c.outstanding)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* スマホ: カード */}
          <ul className="space-y-2 md:hidden">
            {candidates.map((c) => (
              <li
                key={c.householdId}
                className="rounded-lg border border-border bg-surface p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-foreground">
                    {c.householderName} 様
                  </span>
                  <span className="text-foreground">
                    {formatYen(c.outstanding)}
                  </span>
                </div>
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
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* ステップ 2: 督促状の差込 + 出力 + 記録 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground">
              2
            </span>
            督促状の出力と発送記録
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-5">
            <input type="hidden" name="fiscalYear" value={fiscalYear} />

            <FormField
              label="納入期限の記載"
              hint="督促状に記載する期限です。空欄なら記載しません。"
            >
              {(p) => (
                <Input
                  id={p.id}
                  value={dueNote}
                  onChange={(e) => setDueNote(e.target.value)}
                  placeholder="例: 令和8年7月末日まで"
                  aria-describedby={p.describedBy}
                />
              )}
            </FormField>

            <FormField label="本文への追記">
              {(p) => (
                <Textarea
                  id={p.id}
                  rows={3}
                  value={bodyNote}
                  onChange={(e) => setBodyNote(e.target.value)}
                  placeholder="例: ご不明な点はお気軽に寺務所までお問い合わせください。"
                  aria-describedby={p.describedBy}
                />
              )}
            </FormField>

            <div className="rounded-lg border border-border bg-muted/40 p-4">
              <p className="mb-3 text-sm font-medium text-foreground">
                督促状を出力（別タブで開きます）
              </p>
              <a href={pdfUrl()} target="_blank" rel="noopener noreferrer">
                <Button type="button" variant="secondary" size="sm">
                  督促状 PDF（宛名差込）
                </Button>
              </a>
              <p className="mt-2 text-xs text-muted-foreground">
                入力した期限・追記は PDF に反映されます。
              </p>
            </div>

            <div className="border-t border-border pt-4">
              <p className="mb-3 text-sm text-muted-foreground">
                督促状を印刷・発送したら、下のボタンで発送を記録します。
                記録すると各世帯のカルテにも履歴が残ります。
              </p>
              <Button type="submit" size="lg" disabled={isPending}>
                {isPending
                  ? '記録中…'
                  : `この内容で発送を記録する（${candidates.length} 世帯）`}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
