'use client';

import { useTransition } from 'react';
import {
  Button,
  ConfirmDialog,
  useConfirmDialog,
  useToast,
} from '@/components/ui';
import {
  getDocumentDownloadUrlAction,
  softDeleteDocumentAction,
} from './actions';
import { initialDocumentFormState } from './types';

type Props = {
  documentId: string;
  canDelete: boolean;
};

export function DocumentRowActions({ documentId, canDelete }: Props) {
  const { toast } = useToast();
  const confirm = useConfirmDialog();
  const [isPending, startTransition] = useTransition();

  function handlePreview() {
    // ポップアップブロッカ回避: クリック直後に空タブを開き、URL 取得後に遷移させる。
    const win = window.open('', '_blank', 'noopener,noreferrer');
    startTransition(async () => {
      const res = await getDocumentDownloadUrlAction(documentId, 'preview');
      if (res.status === 'ok') {
        if (win) {
          win.location.href = res.url;
        } else {
          window.open(res.url, '_blank', 'noopener,noreferrer');
        }
      } else {
        if (win) win.close();
        toast({ title: 'プレビューを開けませんでした。', variant: 'danger' });
      }
    });
  }

  function handleDelete() {
    const fd = new FormData();
    fd.set('documentId', documentId);
    startTransition(async () => {
      const res = await softDeleteDocumentAction(initialDocumentFormState, fd);
      if (res.status === 'success') {
        toast({ title: '書類を除外しました。', variant: 'success' });
      } else {
        toast({
          title: res.message ?? '除外できませんでした。',
          variant: 'danger',
        });
      }
    });
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <Button
        size="sm"
        variant="secondary"
        onClick={handlePreview}
        disabled={isPending}
      >
        プレビュー
      </Button>
      {canDelete && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => confirm.open(handleDelete)}
          disabled={isPending}
        >
          除外
        </Button>
      )}
      <ConfirmDialog
        {...confirm.props}
        title="この書類を除外しますか？"
        description="一覧から外れます。データ自体は保持され、後から復元のご相談も可能です。"
        confirmLabel="除外する"
        destructive
      />
    </div>
  );
}
