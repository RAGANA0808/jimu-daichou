'use client';

import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
  Textarea,
} from '@/components/ui';
import { recordReintermentAction } from './expiry-actions';

type Props = {
  burialId: string;
  gravePlotId: string;
  /** 故人名 (ダイアログ見出しの確認用)。 */
  personName: string;
};

/**
 * 改葬 (G-8): 1 体の遺骨を区画から出す確認ダイアログ。
 * 理由入力 + 確認チェック必須 (特許回避: 手動確定)。recordReintermentAction で
 * requireCapability('destructive') + recordAudit。論理削除ではなく removedAt 履歴。
 */
export function ReintermentButton({ burialId, gravePlotId, personName }: Props) {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="rounded border border-border px-3 py-1 text-xs text-foreground hover:bg-muted"
        >
          改葬・解除
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>改葬・分骨で区画から出す</DialogTitle>
        <DialogDescription>
          {personName} 様を区画から出した記録を残します（納骨記録は履歴として保持します）。この操作は元に戻せません。
        </DialogDescription>
        <form action={recordReintermentAction} className="mt-4 space-y-4">
          <input type="hidden" name="burialId" value={burialId} />
          <input type="hidden" name="gravePlotId" value={gravePlotId} />
          <div className="space-y-1">
            <label
              htmlFor={`reinter-date-${burialId}`}
              className="block text-sm font-medium text-foreground"
            >
              改葬日（空欄は本日）
            </label>
            <input
              id={`reinter-date-${burialId}`}
              name="removedAt"
              type="date"
              className="block w-full rounded border border-border bg-surface px-3 py-2 text-base text-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>
          <div className="space-y-1">
            <label
              htmlFor={`reinter-reason-${burialId}`}
              className="block text-sm font-medium text-foreground"
            >
              理由 <span className="text-red-600">*</span>
            </label>
            <Textarea
              id={`reinter-reason-${burialId}`}
              name="reason"
              rows={3}
              required
              placeholder="例: ご遺族のご希望により他霊園へ改葬"
            />
          </div>
          <label className="flex items-start gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              name="confirm"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-1 h-5 w-5 rounded border-border accent-brand"
            />
            <span>内容を確認しました。この操作は元に戻せません。</span>
          </label>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                キャンセル
              </Button>
            </DialogClose>
            <Button type="submit" disabled={!confirmed}>
              改葬を記録する
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
