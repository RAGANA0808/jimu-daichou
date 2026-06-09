'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Button, buttonVariants, FormField, Input } from '@/components/ui';
import { updateMyDisplayNameAction } from './actions';
import {
  DISPLAY_NAME_MAX_LENGTH,
  initialAccountProfileFormState,
} from './types';

type Props = {
  initialDisplayName: string;
};

export function AccountProfileForm({ initialDisplayName }: Props) {
  const [state, formAction, isPending] = useActionState(
    updateMyDisplayNameAction,
    initialAccountProfileFormState,
  );

  const value = state.values?.displayName ?? initialDisplayName;

  return (
    <form action={formAction} noValidate className="space-y-5">
      <FormField
        label="表示名"
        required
        error={state.errors?.displayName}
        hint={`対応履歴やダッシュボードの「記録者」として表示されます。${DISPLAY_NAME_MAX_LENGTH} 文字以内。`}
      >
        {(p) => (
          <Input
            id={p.id}
            name="displayName"
            type="text"
            required
            maxLength={DISPLAY_NAME_MAX_LENGTH}
            defaultValue={value}
            placeholder="例: 山田 太郎"
            aria-invalid={p.invalid}
            aria-describedby={p.describedBy}
          />
        )}
      </FormField>

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? '保存中…' : '保存する'}
        </Button>
        <Link href="/settings" className={buttonVariants({ variant: 'secondary' })}>
          キャンセル
        </Link>
      </div>
    </form>
  );
}
