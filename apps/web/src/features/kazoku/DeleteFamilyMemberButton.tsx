'use client';

import { deleteFamilyMemberAction } from './actions';

type Props = {
  personId: string;
  personName: string;
};

/**
 * 家族構成員 (living) を物理削除するボタン。
 * 誤操作防止のため `confirm()` で意思確認。
 * 過去帳に紐づく故人はサーバー側でも弾かれる (living member のみ削除可)。
 */
export function DeleteFamilyMemberButton({ personId, personName }: Props) {
  return (
    <form
      action={deleteFamilyMemberAction}
      onSubmit={(event) => {
        const ok = window.confirm(
          `「${personName}」を家族構成員から削除します。\n\n` +
            `※ この操作は取り消せません。誤登録の修正目的のみにお使いください。\n` +
            `よろしいですか?`,
        );
        if (!ok) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="personId" value={personId} />
      <button
        type="submit"
        className="rounded border border-red-300 bg-white px-4 py-2 text-sm text-red-800 hover:bg-red-100"
      >
        この家族構成員を削除する
      </button>
    </form>
  );
}
