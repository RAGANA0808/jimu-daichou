'use client';

import { useState, useTransition } from 'react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  FormField,
  Select,
} from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import type { ExportFilter, ExportFormat } from '@/lib/export';
import { exportEntityAction } from './actions';

type EntityMeta = {
  id: string;
  label: string;
  description: string;
  filterKind: 'none' | 'month' | 'yearRange';
};

/** base64 をデコードして Blob を生成し、ブラウザでダウンロードさせる。 */
function downloadBase64(base64: string, fileName: string, mimeType: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const CURRENT_YEAR = new Date().getFullYear();

export function ExportPanel({ entity }: { entity: EntityMeta }) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [year, setYear] = useState<string>('');
  const [month, setMonth] = useState<string>('');
  const [fromYear, setFromYear] = useState<string>('');
  const [toYear, setToYear] = useState<string>('');

  function buildFilter(): ExportFilter {
    const num = (v: string): number | null => {
      if (v.trim() === '') return null;
      const n = Number.parseInt(v, 10);
      return Number.isNaN(n) ? null : n;
    };
    return {
      year: num(year),
      month: num(month),
      fromYear: num(fromYear),
      toYear: num(toYear),
    };
  }

  function handleExport(format: ExportFormat) {
    const filter = buildFilter();
    startTransition(async () => {
      const res = await exportEntityAction(entity.id, format, filter);
      if (res.status === 'error') {
        toast({ variant: 'danger', title: res.message });
        return;
      }
      if (res.rowCount === 0) {
        toast({
          variant: 'warning',
          title: '対象のデータがありませんでした。',
          description: '条件を変えて再度お試しください。',
        });
        return;
      }
      downloadBase64(res.base64, res.fileName, res.mimeType);
      toast({
        variant: 'success',
        title: `${res.rowCount} 件を書き出しました。`,
        description: res.fileName,
      });
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{entity.label} を書き出す</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-base text-muted-foreground">{entity.description}</p>

        {entity.filterKind === 'month' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="対象年"
              hint="未指定なら全期間を書き出します。"
            >
              {(p) => (
                <Select
                  id={p.id}
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                >
                  <option value="">全期間</option>
                  {Array.from({ length: 11 }, (_, i) => CURRENT_YEAR - i).map((y) => (
                    <option key={y} value={String(y)}>
                      {y} 年
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
            <FormField label="対象月" hint="年を指定したときのみ有効です。">
              {(p) => (
                <Select
                  id={p.id}
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  disabled={year === ''}
                >
                  <option value="">年全体</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={String(m)}>
                      {m} 月
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
          </div>
        )}

        {entity.filterKind === 'yearRange' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="没年 (開始)" hint="西暦。未指定なら下限なし。">
              {(p) => (
                <input
                  id={p.id}
                  type="number"
                  inputMode="numeric"
                  placeholder="例: 1950"
                  value={fromYear}
                  onChange={(e) => setFromYear(e.target.value)}
                  className="block min-h-touch w-full rounded border border-border bg-surface px-3 py-2 text-base text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-info"
                />
              )}
            </FormField>
            <FormField label="没年 (終了)" hint="西暦。未指定なら上限なし。">
              {(p) => (
                <input
                  id={p.id}
                  type="number"
                  inputMode="numeric"
                  placeholder={`例: ${CURRENT_YEAR}`}
                  value={toYear}
                  onChange={(e) => setToYear(e.target.value)}
                  className="block min-h-touch w-full rounded border border-border bg-surface px-3 py-2 text-base text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-info"
                />
              )}
            </FormField>
          </div>
        )}

        {entity.filterKind === 'none' && (
          <p className="text-sm text-muted-foreground">
            全件を書き出します。
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => handleExport('csv')} disabled={isPending}>
            {isPending ? '書き出し中…' : 'CSV で書き出す'}
          </Button>
          <Button
            variant="secondary"
            onClick={() => handleExport('xlsx')}
            disabled={isPending}
          >
            {isPending ? '書き出し中…' : 'Excel で書き出す'}
          </Button>
          <Badge variant="info">CSV は Excel 互換 (BOM 付 UTF-8)</Badge>
        </div>

        <p className="text-sm text-muted-foreground">
          書き出したファイルの列は取込の項目と揃えています。編集後、そのまま「データ取込」へ読み込めます。
        </p>
      </CardContent>
    </Card>
  );
}
