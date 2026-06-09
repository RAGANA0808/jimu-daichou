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
import {
  interTogetherAction,
  terminateGraveContractAction,
} from './expiry-actions';

// 注: 改葬 (recordReintermentAction) は納骨明細行ごとの操作のため、
// 既存の区画詳細「納骨されている故人」テーブルのアクションに統合する余地があるが、
// 本コンポーネントは区画全体の合祀・墓じまいの確定操作に集約する。

type Props = {
  gravePlotId: string;
  /** 有効契約の id (あれば)。墓じまい・合祀移行で状態を連動遷移させる。 */
  contractId: string | null;
  /** 既に合祀済みなら操作を出さない。 */
  alreadyInterred: boolean;
  /** 残存 (納骨中) の故人が居るか。合祀移行のオプション表示判定。 */
  hasActiveBurials: boolean;
};

/**
 * 合祀・墓じまいの破壊的操作 UI (G-8)。
 *
 * 各操作は確認ダイアログ + 理由入力 + 確認チェックを必須とする (特許回避: 自動遷移を作らず
 * 人が個別に確定)。実行は Server Action (expiry-actions.ts) で requireCapability('destructive')。
 * 表示自体は呼び出し側で役割 (PRIEST 以上) を出し分ける。
 */
export function KyoshiActions({
  gravePlotId,
  contractId,
  alreadyInterred,
  hasActiveBurials,
}: Props) {
  if (alreadyInterred) {
    return (
      <p className="text-sm text-muted-foreground">
        この区画は合祀済みです。これ以上の合祀・墓じまい操作はできません。
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-3">
      <InterTogetherDialog
        gravePlotId={gravePlotId}
        contractId={contractId}
        hasActiveBurials={hasActiveBurials}
      />
      {contractId !== null && (
        <TerminateDialog gravePlotId={gravePlotId} contractId={contractId} />
      )}
    </div>
  );
}

function InterTogetherDialog({
  gravePlotId,
  contractId,
  hasActiveBurials,
}: {
  gravePlotId: string;
  contractId: string | null;
  hasActiveBurials: boolean;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [removeBurials, setRemoveBurials] = useState(hasActiveBurials);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          合祀へ移行する
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>合祀へ移行する</DialogTitle>
        <DialogDescription>
          この区画を合祀済みにします。契約があれば「満了」に変わります。この操作は元に戻せません。
        </DialogDescription>
        <form action={interTogetherAction} className="mt-4 space-y-4">
          <input type="hidden" name="gravePlotId" value={gravePlotId} />
          {contractId !== null && (
            <input type="hidden" name="contractId" value={contractId} />
          )}
          <div className="space-y-1">
            <label
              htmlFor="inter-reason"
              className="block text-sm font-medium text-foreground"
            >
              理由 <span className="text-red-600">*</span>
            </label>
            <Textarea
              id="inter-reason"
              name="reason"
              rows={3}
              required
              placeholder="例: 永代供養期限の到来により合祀へ移行"
            />
          </div>
          {hasActiveBurials && (
            <label className="flex items-start gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                name="removeRemainingBurials"
                checked={removeBurials}
                onChange={(e) => setRemoveBurials(e.target.checked)}
                className="mt-1 h-5 w-5 rounded border-border accent-brand"
              />
              <span>
                納骨中の故人を合祀墓へ移したものとして、区画から除外する（改葬日: 本日）
              </span>
            </label>
          )}
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
              合祀へ移行する
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TerminateDialog({
  gravePlotId,
  contractId,
}: {
  gravePlotId: string;
  contractId: string;
}) {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          墓じまい（解約）
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>墓じまい（契約解約）</DialogTitle>
        <DialogDescription>
          契約を解約し、区画を「墓じまい済」にします。この操作は元に戻せません。
        </DialogDescription>
        <form action={terminateGraveContractAction} className="mt-4 space-y-4">
          <input type="hidden" name="gravePlotId" value={gravePlotId} />
          <input type="hidden" name="contractId" value={contractId} />
          <div className="space-y-1">
            <label
              htmlFor="terminate-reason"
              className="block text-sm font-medium text-foreground"
            >
              理由 <span className="text-red-600">*</span>
            </label>
            <Textarea
              id="terminate-reason"
              name="reason"
              rows={3}
              required
              placeholder="例: ご遺族のご希望により墓じまい"
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
              墓じまいを確定する
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
