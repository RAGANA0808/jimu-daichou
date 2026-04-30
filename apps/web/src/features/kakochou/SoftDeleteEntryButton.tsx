'use client';

import { softDeleteDeathLedgerEntryAction } from './actions';

type Props = {
  entryId: string;
  secularName: string;
};

/**
 * 過去帳エントリを一覧から除外するボタン (物理削除ではなく deletedAt をセット)。
 * 誤操作防止のため `confirm()` で明示的な意思確認を行う。
 */
export function SoftDeleteEntryButton({ entryId, secularName }: Props) {
  return (
    <form
      action={softDeleteDeathLedgerEntryAction}
      onSubmit={(event) => {
        const ok = window.confirm(
          `「${secularName}」の過去帳エントリを一覧から除外します。\n` +
            `データは保持されますが、過去帳一覧・年忌表からは見えなくなります。\n\n` +
            `よろしいですか?`,
        );
        if (!ok) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="entryId" value={entryId} />
      <button
        type="submit"
        className="rounded border border-red-300 bg-white px-4 py-2 text-sm text-red-800 hover:bg-red-100"
      >
        過去帳一覧から除外する
      </button>
    </form>
  );
}
