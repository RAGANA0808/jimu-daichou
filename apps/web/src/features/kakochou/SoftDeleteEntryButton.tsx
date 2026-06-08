'use client';

import { useState } from 'react';
import { Button, FormField, Input } from '@/components/ui';
import { softDeleteDeathLedgerEntryAction } from './actions';

type Props = {
  entryId: string;
  secularName: string;
  /** 'kakochou' を渡すと除外後に過去帳の除外済み一覧へ遷移する。 */
  returnTo?: 'household' | 'kakochou';
};

/**
 * 過去帳エントリを一覧から除外する (物理削除ではなく deletedAt をセット)。
 * 100 年運用の追跡性のため、除外理由を任意で記録できる。
 * 誤操作防止のため、まず確認パネルを開いてから実行する。
 */
export function SoftDeleteEntryButton({ entryId, secularName, returnTo }: Props) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button variant="danger" onClick={() => setOpen(true)}>
        過去帳一覧から除外する
      </Button>
    );
  }

  return (
    <form
      action={softDeleteDeathLedgerEntryAction}
      className="space-y-4 rounded-lg border border-danger/30 bg-danger-soft p-4"
    >
      <input type="hidden" name="entryId" value={entryId} />
      {returnTo === 'kakochou' && (
        <input type="hidden" name="returnTo" value="kakochou" />
      )}
      <p className="text-sm text-foreground">
        「{secularName}」を過去帳一覧から除外します。データと履歴は保持され、
        後から復元できます。
      </p>
      <FormField
        label="除外理由（任意）"
        hint="誤登録・重複 など。後から除外済み一覧で確認できます。"
      >
        {(p) => (
          <Input
            id={p.id}
            name="deletedReason"
            placeholder="例: 重複登録のため"
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
