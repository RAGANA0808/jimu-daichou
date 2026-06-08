'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { Button, FormField, Input, useToast } from '@/components/ui';
import { uploadDocumentAction } from './actions';
import { initialDocumentFormState, type DocumentTargetKind } from './types';

type Props = { targetKind: DocumentTargetKind; targetId: string };

// 撮影用とファイル選択用で input を 2 個に分ける。
// 「写真を撮る」は capture 属性が要るため input へ直接付与する必要がある。
// 選択された側にだけ name="file" を付け、未選択側は name を外して送信対象から除外する
// (空の input が後勝ちで上書きする事故を防ぐ)。
type Source = 'camera' | 'file' | null;

const FILE_ACCEPT =
  'application/pdf,image/*,.doc,.docx,.xls,.xlsx';

export function DocumentUploadForm({ targetKind, targetId }: Props) {
  const [state, formAction, isPending] = useActionState(
    uploadDocumentAction,
    initialDocumentFormState,
  );
  const { toast } = useToast();

  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<Source>(null);
  const [pickedName, setPickedName] = useState<string | null>(null);

  useEffect(() => {
    if (state.status === 'success') {
      if (cameraRef.current) cameraRef.current.value = '';
      if (fileRef.current) fileRef.current.value = '';
      setSource(null);
      setPickedName(null);
      toast({ title: '書類を追加しました。', variant: 'success' });
    }
  }, [state, toast]);

  function pick(which: 'camera' | 'file') {
    const target = which === 'camera' ? cameraRef.current : fileRef.current;
    target?.click();
  }

  function onCameraChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (f) {
      setSource('camera');
      setPickedName(f.name);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (f) {
      setSource('file');
      setPickedName(f.name);
      if (cameraRef.current) cameraRef.current.value = '';
    }
  }

  return (
    <form
      action={formAction}
      className="mb-5 space-y-4 rounded-lg border border-border bg-muted/40 p-4"
    >
      <input type="hidden" name="targetKind" value={targetKind} />
      <input type="hidden" name="targetId" value={targetId} />

      {/* 撮影用 (capture)。選択された時だけ name を付ける。 */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        name={source === 'camera' ? 'file' : undefined}
        onChange={onCameraChange}
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
      />
      {/* ファイル選択用。選択された時だけ name を付ける。 */}
      <input
        ref={fileRef}
        type="file"
        accept={FILE_ACCEPT}
        name={source === 'file' ? 'file' : undefined}
        onChange={onFileChange}
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
      />

      <div className="flex flex-wrap gap-3">
        <Button type="button" size="lg" variant="secondary" onClick={() => pick('camera')}>
          写真を撮る
        </Button>
        <Button type="button" size="lg" variant="secondary" onClick={() => pick('file')}>
          ファイルを選ぶ
        </Button>
      </div>

      {pickedName && (
        <p className="text-sm text-muted-foreground">選択中: {pickedName}</p>
      )}

      <FormField
        label="書類名"
        required
        error={state.errors?.title}
        hint="一覧に表示される名前です。例: 墓地使用許可証"
      >
        {(p) => (
          <Input
            id={p.id}
            name="title"
            defaultValue={state.values?.title ?? ''}
            placeholder="例: 墓地使用許可証"
            aria-invalid={p.invalid}
            aria-describedby={p.describedBy}
          />
        )}
      </FormField>

      {state.status === 'error' && state.message && (
        <p className="text-sm text-danger">{state.message}</p>
      )}

      <Button type="submit" disabled={isPending || !pickedName}>
        {isPending ? 'アップロード中…' : '書類を追加'}
      </Button>
    </form>
  );
}
