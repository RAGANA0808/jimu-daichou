'use client';

import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  FormField,
  Input,
} from '@/components/ui';
import { formatYen } from './format';

export type GeneratorSubject = {
  id: string;
  name: string;
  amountSourceLabel: string;
};

type Props = {
  fiscalYear: number;
  /** 出力対象 (金額ありの) 世帯数。 */
  payableCount: number;
  subjects: GeneratorSubject[];
  hasAccount: boolean;
};

/**
 * 一括 PDF 生成のコントロール (特許回避: 自動配信ではなく住職が手動で出力)。
 * 既製用紙へのオーバープリント / 枠ガイド付きプレビュー / 別紙明細つきを選べる。
 */
export function PostalTransferGenerator({
  fiscalYear,
  payableCount,
  subjects,
  hasAccount,
}: Props) {
  const [withDetail, setWithDetail] = useState(true);
  const [showGuide, setShowGuide] = useState(false);

  function bulkUrl(): string {
    const sp = new URLSearchParams({ year: String(fiscalYear) });
    if (withDetail) sp.set('detail', '1');
    if (showGuide) sp.set('guide', '1');
    return `/api/furikae/pdf?${sp.toString()}`;
  }

  const disabled = payableCount === 0 || subjects.length === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground">
            2
          </span>
          振替用紙の一括生成（{fiscalYear} 年度）
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 text-base">
          <Badge variant={payableCount > 0 ? 'info' : 'warning'}>
            出力対象 {payableCount} 世帯
          </Badge>
          <span className="text-muted-foreground">
            離檀・弔い上げ世帯は除外しています
          </span>
        </div>

        {!hasAccount && (
          <p className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-foreground">
            加入者名・口座記号番号が未設定です。「設定」から寺の口座情報をご登録ください（未設定でも氏名・金額の印字は可能です）。
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-start gap-3 rounded-lg border border-border bg-surface p-3">
            <input
              type="checkbox"
              checked={withDetail}
              onChange={(e) => setWithDetail(e.target.checked)}
              className="mt-1 h-5 w-5"
            />
            <span>
              <span className="block font-medium text-foreground">
                別紙明細をつける
              </span>
              <span className="block text-sm text-muted-foreground">
                檀家が「何にいくら」払うか分かる内訳を A4 で添付します。
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-lg border border-border bg-surface p-3">
            <input
              type="checkbox"
              checked={showGuide}
              onChange={(e) => setShowGuide(e.target.checked)}
              className="mt-1 h-5 w-5"
            />
            <span>
              <span className="block font-medium text-foreground">
                位置合わせガイドを表示
              </span>
              <span className="block text-sm text-muted-foreground">
                枠線つきで出力します。白紙に印刷して実物の用紙と重ね、ズレを確認できます。
              </span>
            </span>
          </label>
        </div>

        <div className="rounded-lg border border-border bg-muted/40 p-4">
          <p className="mb-3 text-sm text-muted-foreground">
            ボタンを押すと別タブで PDF を開きます。印刷して既製の払込取扱票に重ねて使用します。位置がずれる場合は「設定」の印字位置オフセットで微調整してください。
          </p>
          {disabled ? (
            <Button type="button" variant="secondary" size="lg" disabled>
              出力できる対象がありません
            </Button>
          ) : (
            <a href={bulkUrl()} target="_blank" rel="noopener noreferrer">
              <Button type="button" size="lg">
                振替用紙を一括出力（{payableCount} 世帯）
              </Button>
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/** 1 世帯分の金額を確認・微調整して単票出力する小フォーム (世帯詳細用)。 */
export function SingleSlipGenerator({
  fiscalYear,
  householdId,
  lines,
}: {
  fiscalYear: number;
  householdId: string;
  lines: Array<{ subjectId: string; name: string; amount: number }>;
}) {
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(lines.map((l) => [l.subjectId, String(l.amount)])),
  );
  const [withDetail, setWithDetail] = useState(true);

  const total = Object.values(amounts).reduce((s, v) => {
    const n = Number.parseInt(v, 10);
    return s + (Number.isFinite(n) && n > 0 ? n : 0);
  }, 0);

  function url(): string {
    const sp = new URLSearchParams({
      year: String(fiscalYear),
      householdId,
    });
    const pairs = lines
      .map((l) => {
        const raw = amounts[l.subjectId] ?? '0';
        const n = Number.parseInt(raw, 10);
        return `${l.subjectId}:${Number.isFinite(n) && n > 0 ? n : 0}`;
      })
      .join(',');
    sp.set('amounts', pairs);
    if (withDetail) sp.set('detail', '1');
    return `/api/furikae/pdf?${sp.toString()}`;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">郵便振替用紙の作成</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            科目が登録されていません。郵便振替の「設定」から科目を追加してください。
          </p>
        ) : (
          <>
            <div className="space-y-3">
              {lines.map((l) => (
                <FormField key={l.subjectId} label={l.name}>
                  {(p) => (
                    <Input
                      id={p.id}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={amounts[l.subjectId] ?? ''}
                      onChange={(e) =>
                        setAmounts((prev) => ({
                          ...prev,
                          [l.subjectId]: e.target.value,
                        }))
                      }
                    />
                  )}
                </FormField>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-border pt-3 text-lg">
              <span className="text-muted-foreground">合計</span>
              <span className="font-medium text-foreground">
                {formatYen(total)}
              </span>
            </div>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={withDetail}
                onChange={(e) => setWithDetail(e.target.checked)}
                className="h-5 w-5"
              />
              <span className="text-base text-foreground">別紙明細をつける</span>
            </label>

            <a href={url()} target="_blank" rel="noopener noreferrer">
              <Button type="button" size="lg" disabled={total === 0}>
                この内容で振替用紙を出力
              </Button>
            </a>
          </>
        )}
      </CardContent>
    </Card>
  );
}
