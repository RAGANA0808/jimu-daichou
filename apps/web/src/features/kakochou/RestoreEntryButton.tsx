'use client';

import { Button } from '@/components/ui';
import { restoreDeathLedgerEntryAction } from './actions';

type Props = {
  entryId: string;
  secularName: string;
};

/**
 * 除外 (論理削除) 済みの過去帳エントリを復元する。
 * 物理削除はしていないため、除外済みのエントリは必ず復元できる。
 */
export function RestoreEntryButton({ entryId, secularName }: Props) {
  return (
    <form
      action={restoreDeathLedgerEntryAction}
      onSubmit={(event) => {
        const ok = window.confirm(
          `「${secularName}」を過去帳一覧へ復元します。よろしいですか?`,
        );
        if (!ok) event.preventDefault();
      }}
    >
      <input type="hidden" name="entryId" value={entryId} />
      <Button variant="secondary" size="sm" type="submit">
        復元する
      </Button>
    </form>
  );
}
