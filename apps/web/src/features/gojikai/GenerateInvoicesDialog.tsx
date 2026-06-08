'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
  useToast,
} from '@/components/ui';
import { generateInvoicesAction } from './actions';
import { initialGenerateFormState } from './types';

type Props = {
  fiscalYear: number;
  /** 台帳の有効件数 (生成見込みの目安表示)。 */
  activePlanCount: number;
};

/**
 * 年度請求の一括生成 (手動トリガ + 送信前確認)。
 * 死亡/期日起点の全自動ではなく、住職が年度を確認してボタンで生成する。
 */
export function GenerateInvoicesDialog({ fiscalYear, activePlanCount }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [state, formAction, isPending] = useActionState(
    generateInvoicesAction,
    initialGenerateFormState,
  );

  useEffect(() => {
    if (state.status === 'success') {
      toast({
        title: `${state.fiscalYear} 年度の請求を作成しました`,
        description: `新規 ${state.created} 件 / 既存のため除外 ${state.skippedExisting} 件 / 休止 ${state.skippedInactive} 件`,
        variant: 'success',
      });
      router.refresh();
    } else if (state.status === 'error' && state.formError) {
      toast({ title: state.formError, variant: 'danger' });
    }
  }, [state, toast, router]);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>{fiscalYear} 年度の請求を生成</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>{fiscalYear} 年度の請求を一括生成</DialogTitle>
        <DialogDescription>
          会費台帳 (有効 {activePlanCount} 世帯) をもとに、{fiscalYear}{' '}
          年度の請求をまとめて作成します。
          すでにこの年度の請求がある世帯・休止中の台帳は対象外です。重複して作成されることはありません。
        </DialogDescription>
        <form action={formAction}>
          <input type="hidden" name="fiscalYear" value={fiscalYear} />
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                やめる
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? '生成中…' : 'この年度で生成する'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
