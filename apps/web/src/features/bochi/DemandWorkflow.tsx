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
import { recordDemandShipmentAction } from './actions';
import { initialDemandRecordState } from './types';
import { formatYen } from './format';
import type { DemandCandidate } from './queries';

type Props = {
  fiscalYear: number;
  candidates: DemandCandidate[];
};

const DEMAND_ROUNDS = [1, 2, 3, 4, 5] as const;

/**
 * 滞納区画の確認 → 催告状 PDF 出力 → 発送記録 の手動ワークフロー (特許回避)。
 * 区画 → 契約世帯の宛名解決を行い、宛名解決できない区画は注意喚起する。
 */
export function DemandWorkflow({ fiscalYear, candidates }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [state, formAction, isPending] = useActionState(
    recordDemandShipmentAction,
    initialDemandRecordState,
  );

  const [round, setRound] = useState('1');
  const [dueNote, setDueNote] = useState('');
  const [bodyNote, setBodyNote] = useState('');

  const sendable = candidates.filter((c) => !c.missingHousehold);
  const missingHouseholdCount = candidates.length - sendable.length;
  const missingAddressCount = sendable.filter((c) => c.missingAddress).length;
  const totalOutstanding = candidates.reduce(
    (s, c) => s + c.totalOutstanding,
    0,
  );

  useEffect(() => {
    if (state.status === 'success' && state.createdBatchId) {
      toast({
        title: '催告状の発送を記録しました',
        description: '各契約世帯のカルテにも履歴を残しました。',
        variant: 'success',
      });
      router.push(`/hasso/${state.createdBatchId}`);
    } else if (state.status === 'error' && state.formError) {
      toast({ title: state.formError, variant: 'danger' });
    }
  }, [state, toast, router]);

  function pdfUrl(): string {
    const sp = new URLSearchParams({ year: String(fiscalYear), round });
    if (dueNote.trim()) sp.set('dueNote', dueNote.trim());
    if (bodyNote.trim()) sp.set('bodyNote', bodyNote.trim());
    return `/api/bochi/demand?${sp.toString()}`;
  }

  return (
    <div className="space-y-6">
      {/* ステップ 1: 滞納区画の確認 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground">
              1
            </span>
            滞納区画の確認（{fiscalYear} 年度時点）
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-base">
            <Badge variant="danger">{candidates.length} 区画</Badge>
            <span className="text-foreground">
              累積未納合計 {formatYen(totalOutstanding)}
            </span>
            {missingHouseholdCount > 0 && (
              <Badge variant="warning">
                契約世帯なし {missingHouseholdCount} 区画
              </Badge>
            )}
            {missingAddressCount > 0 && (
              <Badge variant="warning">
                住所未登録 {missingAddressCount} 区画
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
                      区画
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-brand-foreground">
                      宛名（契約世帯）
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-muted-foreground">
                      滞納年数
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-muted-foreground">
                      累積未納額
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {candidates.map((c) => (
                    <tr key={c.gravePlotId} className="bg-surface">
                      <td className="px-4 py-3 text-foreground">
                        区画 {c.plotNumber}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {c.missingHousehold ? (
                          <Badge variant="warning">契約世帯なし</Badge>
                        ) : (
                          <span>
                            {c.householderName} 様
                            {c.missingAddress && (
                              <Badge variant="warning" className="ml-2">
                                住所未登録
                              </Badge>
                            )}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-foreground">
                        {c.elapsedYears} 年
                        <span className="ml-1 text-sm text-muted-foreground">
                          ({c.oldestUnpaidYear} 年〜)
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-foreground">
                        {formatYen(c.totalOutstanding)}
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
                key={c.gravePlotId}
                className="rounded-lg border border-border bg-surface p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-foreground">
                    区画 {c.plotNumber}
                  </span>
                  <span className="text-foreground">
                    {formatYen(c.totalOutstanding)}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                  {c.missingHousehold ? (
                    <Badge variant="warning">契約世帯なし</Badge>
                  ) : (
                    <span className="text-muted-foreground">
                      {c.householderName} 様
                    </span>
                  )}
                  <span className="text-muted-foreground">
                    滞納 {c.elapsedYears} 年
                  </span>
                  {c.missingAddress && (
                    <Badge variant="warning">住所未登録</Badge>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {missingHouseholdCount > 0 && (
            <p className="text-sm text-muted-foreground">
              契約世帯が登録されていない区画は宛名を解決できないため、催告状の発送対象から除外されます。
              区画管理から契約世帯をご登録ください。
            </p>
          )}
        </CardContent>
      </Card>

      {/* ステップ 2: 催告状の差込 + 出力 + 記録 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground">
              2
            </span>
            催告状の出力と発送記録
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-5">
            <input type="hidden" name="fiscalYear" value={fiscalYear} />
            <input type="hidden" name="round" value={round} />

            <FormField
              label="催告回（第何回催告か）"
              hint="送付履歴に記録されます。"
            >
              {(p) => (
                <Select
                  id={p.id}
                  value={round}
                  onChange={(e) => setRound(e.target.value)}
                  aria-describedby={p.describedBy}
                >
                  {DEMAND_ROUNDS.map((r) => (
                    <option key={r} value={String(r)}>
                      第 {r} 回催告
                    </option>
                  ))}
                </Select>
              )}
            </FormField>

            <FormField
              label="納入期限の記載"
              hint="催告状に記載する期限です。空欄なら記載しません。"
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
                催告状を出力（別タブで開きます）
              </p>
              <a href={pdfUrl()} target="_blank" rel="noopener noreferrer">
                <Button type="button" variant="secondary" size="sm">
                  催告状 PDF（宛名差込）
                </Button>
              </a>
              <p className="mt-2 text-xs text-muted-foreground">
                入力した催告回・期限・追記は PDF に反映されます。宛名を解決できる
                {sendable.length} 区画ぶんが出力されます。
              </p>
            </div>

            <div className="border-t border-border pt-4">
              <p className="mb-3 text-sm text-muted-foreground">
                催告状を印刷・発送したら、下のボタンで発送を記録します。
                記録すると各契約世帯のカルテにも履歴が残ります。
              </p>
              <Button
                type="submit"
                size="lg"
                disabled={isPending || sendable.length === 0}
              >
                {isPending
                  ? '記録中…'
                  : `この内容で発送を記録する（${sendable.length} 区画）`}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
