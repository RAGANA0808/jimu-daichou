'use client';

import { useState } from 'react';
import { Button, FormField, Input } from '@/components/ui';
import { softDeleteCircuitTourAction } from './actions';

type Props = {
  circuitTourId: string;
  title: string;
};

/**
 * 巡回を一覧から除外する (物理削除ではなく deletedAt をセット)。
 * 誤操作防止のため、まず確認パネルを開いてから実行する。
 */
export function SoftDeleteCircuitTourButton({ circuitTourId, title }: Props) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button variant="danger" onClick={() => setOpen(true)}>
        この巡回を除外する
      </Button>
    );
  }

  return (
    <form
      action={softDeleteCircuitTourAction}
      className="space-y-4 rounded-lg border border-danger/30 bg-danger-soft p-4"
    >
      <input type="hidden" name="circuitTourId" value={circuitTourId} />
      <p className="text-sm text-foreground">
        「{title}」を巡回一覧から除外します。記録は保持されます。
      </p>
      <FormField label="除外理由（任意）" hint="中止・重複登録 など。">
        {(p) => (
          <Input
            id={p.id}
            name="deletedReason"
            placeholder="例: 日程変更のため"
            aria-describedby={p.describedBy}
          />
        )}
      </FormField>
      <div className="flex items-center gap-3">
        <Button variant="danger" type="submit">
          除外する
        </Button>
        <Button variant="secondary" type="button" onClick={() => setOpen(false)}>
          やめる
        </Button>
      </div>
    </form>
  );
}
