'use client';

import { useState, useTransition } from 'react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import type {
  ColumnDef,
  ColumnMapping,
  ImportPreview,
  ParsedSheet,
} from '@/lib/import';
import {
  confirmImportAction,
  parseUploadAction,
  previewImportAction,
} from './actions';

type Step = 'upload' | 'mapping' | 'preview' | 'done';

type EntityMeta = { id: string; label: string; description: string };

export function ImportWizard({
  entity,
  columns,
}: {
  entity: EntityMeta;
  columns: ColumnDef[];
}) {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('upload');
  const [isPending, startTransition] = useTransition();

  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [preview, setPreview] = useState<ImportPreview<unknown> | null>(null);
  const [result, setResult] = useState<{ inserted: number; skipped: number } | null>(null);

  function handleUpload(formData: FormData) {
    formData.set('entityId', entity.id);
    startTransition(async () => {
      const res = await parseUploadAction(formData);
      if (res.status === 'error') {
        toast({ variant: 'danger', title: res.message });
        return;
      }
      setSheet(res.sheet);
      setMapping(res.mapping);
      setStep('mapping');
    });
  }

  function handlePreview() {
    if (!sheet) return;
    startTransition(async () => {
      const res = await previewImportAction(entity.id, sheet, mapping);
      if (res.status === 'error') {
        toast({ variant: 'danger', title: res.message });
        return;
      }
      setPreview(res.preview);
      setStep('preview');
    });
  }

  function handleConfirm() {
    if (!sheet) return;
    startTransition(async () => {
      const res = await confirmImportAction(entity.id, sheet, mapping);
      if (res.status === 'error') {
        toast({ variant: 'danger', title: res.message });
        return;
      }
      setResult({ inserted: res.inserted, skipped: res.skipped });
      setStep('done');
      toast({
        variant: 'success',
        title: `${res.inserted} 件を取り込みました。`,
      });
    });
  }

  function reset() {
    setSheet(null);
    setMapping({});
    setPreview(null);
    setResult(null);
    setStep('upload');
  }

  return (
    <div className="space-y-6">
      <StepIndicator step={step} />

      {step === 'upload' && (
        <UploadStep entity={entity} onUpload={handleUpload} disabled={isPending} />
      )}

      {step === 'mapping' && sheet && (
        <MappingStep
          sheet={sheet}
          columns={columns}
          mapping={mapping}
          onChange={setMapping}
          onBack={reset}
          onNext={handlePreview}
          disabled={isPending}
        />
      )}

      {step === 'preview' && preview && (
        <PreviewStep
          preview={preview}
          columns={columns}
          onBack={() => setStep('mapping')}
          onConfirm={handleConfirm}
          disabled={isPending}
        />
      )}

      {step === 'done' && result && (
        <DoneStep result={result} onReset={reset} />
      )}
    </div>
  );
}

const STEP_LABELS: { key: Step; label: string }[] = [
  { key: 'upload', label: '1. ファイル選択' },
  { key: 'mapping', label: '2. 列の対応付け' },
  { key: 'preview', label: '3. プレビュー' },
  { key: 'done', label: '4. 完了' },
];

function StepIndicator({ step }: { step: Step }) {
  const currentIndex = STEP_LABELS.findIndex((s) => s.key === step);
  return (
    <ol className="flex flex-wrap gap-2 text-sm" aria-label="取込の手順">
      {STEP_LABELS.map((s, i) => {
        const state =
          i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'upcoming';
        return (
          <li key={s.key}>
            <span
              className={[
                'inline-flex items-center rounded-full border px-3 py-1',
                state === 'current'
                  ? 'border-primary bg-primary text-primary-foreground'
                  : state === 'done'
                    ? 'border-success/40 bg-success-soft text-success'
                    : 'border-border bg-muted text-muted-foreground',
              ].join(' ')}
              aria-current={state === 'current' ? 'step' : undefined}
            >
              {s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function UploadStep({
  entity,
  onUpload,
  disabled,
}: {
  entity: EntityMeta;
  onUpload: (fd: FormData) => void;
  disabled: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{entity.label} を取り込む</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-base text-muted-foreground">{entity.description}</p>
        <form
          action={onUpload}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <label
              htmlFor="import-file"
              className="block text-base font-medium text-foreground"
            >
              ファイル (CSV / Excel)
              <span className="ml-1 text-danger" aria-hidden="true">
                *
              </span>
            </label>
            <p className="text-sm text-muted-foreground">
              1 行目を見出し行として読み込みます。文字コードは UTF-8 を推奨します。
            </p>
            <input
              id="import-file"
              name="file"
              type="file"
              accept=".csv,.xlsx,.xls"
              required
              className="block w-full min-h-touch rounded border border-border bg-surface px-3 py-2 text-base file:mr-4 file:rounded file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-foreground"
            />
          </div>
          <Button type="submit" disabled={disabled}>
            {disabled ? '読み込み中…' : 'ファイルを読み込む'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function MappingStep({
  sheet,
  columns,
  mapping,
  onChange,
  onBack,
  onNext,
  disabled,
}: {
  sheet: ParsedSheet;
  columns: ColumnDef[];
  mapping: ColumnMapping;
  onChange: (m: ColumnMapping) => void;
  onBack: () => void;
  onNext: () => void;
  disabled: boolean;
}) {
  const sample = sheet.rows.slice(0, 3);

  function setColumn(key: string, value: string) {
    const idx = value === '' ? null : Number.parseInt(value, 10);
    onChange({ ...mapping, [key]: Number.isNaN(idx as number) ? null : idx });
  }

  const missingRequired = columns.filter(
    (c) => c.required && (mapping[c.key] === null || mapping[c.key] === undefined),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>列の対応付け</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-base text-muted-foreground">
          ファイルの列を、システムの項目に割り当ててください。自動で推測した内容を必要に応じて修正できます。
        </p>

        <div className="space-y-3">
          {columns.map((col) => {
            const selectedIdx = mapping[col.key];
            const preview =
              selectedIdx !== null && selectedIdx !== undefined
                ? (sample.map((r) => r[selectedIdx ?? 0]).filter(Boolean).join(' / ') || '—')
                : '';
            return (
              <div
                key={col.key}
                className="grid gap-2 rounded-lg border border-border bg-surface p-3 sm:grid-cols-[1fr_1fr_1fr] sm:items-center"
              >
                <div>
                  <p className="font-medium text-foreground">
                    {col.label}
                    {col.required ? (
                      <span className="ml-2">
                        <Badge variant="info">必須</Badge>
                      </span>
                    ) : (
                      <span className="ml-2">
                        <Badge variant="neutral">任意</Badge>
                      </span>
                    )}
                  </p>
                  {col.hint && (
                    <p className="mt-1 text-sm text-muted-foreground">{col.hint}</p>
                  )}
                </div>
                <Select
                  aria-label={`${col.label} に対応する列`}
                  value={selectedIdx === null || selectedIdx === undefined ? '' : String(selectedIdx)}
                  onChange={(e) => setColumn(col.key, e.target.value)}
                >
                  <option value="">(取り込まない)</option>
                  {sheet.headers.map((h, i) => (
                    <option key={i} value={String(i)}>
                      {h}
                    </option>
                  ))}
                </Select>
                <p className="truncate text-sm text-muted-foreground" title={preview}>
                  {preview ? `例: ${preview}` : '—'}
                </p>
              </div>
            );
          })}
        </div>

        {missingRequired.length > 0 && (
          <p className="rounded border border-warning/30 bg-warning-soft px-3 py-2 text-sm text-warning">
            必須項目が未割当です: {missingRequired.map((c) => c.label).join('、')}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={onBack} disabled={disabled}>
            戻る
          </Button>
          <Button
            onClick={onNext}
            disabled={disabled || missingRequired.length > 0}
          >
            {disabled ? '確認中…' : 'プレビューへ進む'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PreviewStep({
  preview,
  columns,
  onBack,
  onConfirm,
  disabled,
}: {
  preview: ImportPreview<unknown>;
  columns: ColumnDef[];
  onBack: () => void;
  onConfirm: () => void;
  disabled: boolean;
}) {
  const { counts, rows } = preview;
  const insertable = counts.total - counts.error - counts.warning;
  // 表示列は必須 + 主要任意のみ (横幅対策)。
  const displayColumns = columns.filter(
    (c) => c.required || ['phone', 'mobile', 'address'].includes(c.key),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>プレビュー</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-4">
          <SummaryTile label="全行数" value={counts.total} variant="neutral" />
          <SummaryTile label="取込予定" value={insertable} variant="success" />
          <SummaryTile label="警告 (スキップ)" value={counts.warning} variant="warning" />
          <SummaryTile label="エラー (除外)" value={counts.error} variant="danger" />
        </div>

        <p className="text-sm text-muted-foreground">
          エラー行と警告 (重複) 行は確定時に取り込みません。確定すると {insertable} 件を登録します。
        </p>

        {rows.length === 0 ? (
          <EmptyState title="取込対象の行がありません。" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">行</TableHead>
                <TableHead className="w-28">状態</TableHead>
                {displayColumns.map((c) => (
                  <TableHead key={c.key}>{c.label}</TableHead>
                ))}
                <TableHead>メッセージ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.rowIndex}>
                  <TableCell className="text-muted-foreground">
                    {row.rowIndex + 1}
                  </TableCell>
                  <TableCell>
                    <RowBadge severity={row.severity} />
                  </TableCell>
                  {displayColumns.map((c) => (
                    <TableCell key={c.key} className="text-sm">
                      {row.values[c.key] || (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  ))}
                  <TableCell className="text-sm">
                    {row.issues.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <ul className="space-y-1">
                        {row.issues.map((issue, i) => (
                          <li
                            key={i}
                            className={
                              issue.severity === 'error'
                                ? 'text-danger'
                                : 'text-warning'
                            }
                          >
                            {issue.message}
                          </li>
                        ))}
                      </ul>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={onBack} disabled={disabled}>
            列の対応付けへ戻る
          </Button>
          <Button onClick={onConfirm} disabled={disabled || insertable === 0}>
            {disabled ? '登録中…' : `${insertable} 件を確定して取り込む`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryTile({
  label,
  value,
  variant,
}: {
  label: string;
  value: number;
  variant: 'neutral' | 'success' | 'warning' | 'danger';
}) {
  const tone = {
    neutral: 'border-border bg-muted text-foreground',
    success: 'border-success/30 bg-success-soft text-success',
    warning: 'border-warning/30 bg-warning-soft text-warning',
    danger: 'border-danger/30 bg-danger-soft text-danger',
  }[variant];
  return (
    <div className={`rounded-lg border px-4 py-3 ${tone}`}>
      <p className="text-sm">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

function RowBadge({ severity }: { severity: 'ok' | 'warning' | 'error' }) {
  if (severity === 'ok') return <Badge variant="success">取込</Badge>;
  if (severity === 'warning') return <Badge variant="warning">スキップ</Badge>;
  return <Badge variant="danger">除外</Badge>;
}

function DoneStep({
  result,
  onReset,
}: {
  result: { inserted: number; skipped: number };
  onReset: () => void;
}) {
  return (
    <Card>
      <CardContent className="py-10">
        <EmptyState
          title="取り込みが完了しました。"
          description={`${result.inserted} 件を登録しました。${
            result.skipped > 0 ? `${result.skipped} 件は警告・エラーのため取り込みませんでした。` : ''
          }`}
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <Button onClick={onReset}>続けて別のファイルを取り込む</Button>
            </div>
          }
        />
      </CardContent>
    </Card>
  );
}
