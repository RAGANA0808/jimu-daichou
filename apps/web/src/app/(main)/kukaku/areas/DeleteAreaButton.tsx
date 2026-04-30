'use client';

type Props = {
  areaId: string;
  areaName: string;
  plotCount: number;
  action: (formData: FormData) => Promise<void>;
};

export function DeleteAreaButton({
  areaId,
  areaName,
  plotCount,
  action,
}: Props) {
  const warning =
    plotCount > 0
      ? `エリア "${areaName}" を削除します。\n配下の区画 ${plotCount} 件は未配置に戻ります (区画自体は削除されません)。\n\nよろしいですか?`
      : `エリア "${areaName}" を削除します。よろしいですか?`;

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(warning)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="gravePlotAreaId" value={areaId} />
      <button
        type="submit"
        className="inline-block rounded border border-red-300 px-3 py-1 text-xs text-red-700 hover:bg-red-50"
      >
        削除
      </button>
    </form>
  );
}
