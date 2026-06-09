'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './dialog';
import { Button } from './button';

export type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 破壊的操作 (除外/閉じる等) のとき true にすると確定ボタンを danger 色にする。 */
  destructive?: boolean;
  onConfirm: () => void;
};

/**
 * window.confirm の置換用確認モーダル。
 * - フォーカストラップ・ESC・オーバーレイクリックで閉じる挙動は Radix が担保。
 * - 破壊的操作 (論理削除/除外) では destructive を立てて視覚的に警告する。
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = '実行する',
  cancelLabel = 'キャンセル',
  destructive = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? 'danger' : 'primary'}
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * 確認モーダルの開閉状態を簡潔に扱うフック。
 * 例:
 *   const confirm = useConfirmDialog();
 *   <Button onClick={() => confirm.open(() => doDelete())}>除外</Button>
 *   <ConfirmDialog {...confirm.props} title="..." />
 */
export function useConfirmDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [action, setAction] = useState<(() => void) | null>(null);

  return {
    open(onConfirm: () => void) {
      setAction(() => onConfirm);
      setIsOpen(true);
    },
    props: {
      open: isOpen,
      onOpenChange: setIsOpen,
      onConfirm: () => action?.(),
    },
  };
}
