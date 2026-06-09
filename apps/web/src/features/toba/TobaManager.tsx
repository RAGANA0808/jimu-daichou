'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  EmptyState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useConfirmDialog,
  useToast,
} from '@/components/ui';
import {
  createTobaAction,
  deleteTobaAction,
  moveTobaAction,
  updateTobaAction,
} from './actions';
import { TobaForm, type TargetPersonOption } from './TobaForm';

export type TobaListItem = {
  id: string;
  applicantName: string;
  targetPersonName: string | null;
  targetPersonId: string | null;
  count: number;
  inscription: string;
  offeringAmount: number | null;
  memo: string | null;
};

type Props = {
  memorialServiceId: string;
  tobas: TobaListItem[];
  targetPersons: TargetPersonOption[];
};

export function TobaManager({ memorialServiceId, tobas, targetPersons }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const confirm = useConfirmDialog();
  const [isPending, startTransition] = useTransition();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const totalCount = tobas.reduce((sum, t) => sum + t.count, 0);

  function handleMove(tobaId: string, direction: 'up' | 'down') {
    startTransition(async () => {
      const result = await moveTobaAction({
        tobaId,
        memorialServiceId,
        direction,
      });
      if (result.status === 'error') {
        toast({ title: '並べ替えに失敗しました', description: result.message, variant: 'danger' });
      } else {
        router.refresh();
      }
    });
  }

  function handleDelete(tobaId: string) {
    confirm.open(() => {
      startTransition(async () => {
        const result = await deleteTobaAction({ tobaId, memorialServiceId });
        if (result.status === 'error') {
          toast({ title: '削除に失敗しました', description: result.message, variant: 'danger' });
        } else {
          toast({ title: '塔婆申込を削除しました', variant: 'success' });
          router.refresh();
        }
      });
    });
  }

  function handleSaved(message: string) {
    setShowAddForm(false);
    setEditingId(null);
    toast({ title: message, variant: 'success' });
    router.refresh();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <CardTitle className="text-lg">塔婆申込・読上帳</CardTitle>
          <p className="text-sm text-muted-foreground">
            読上順に並んでいます。合計 {tobas.length} 件 / {totalCount} 本
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {tobas.length > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                window.open(
                  `/api/toba/pdf?memorialServiceId=${memorialServiceId}`,
                  '_blank',
                  'noopener',
                );
              }}
            >
              読上帳を PDF 出力
            </Button>
          )}
          {!showAddForm && (
            <Button
              size="sm"
              onClick={() => {
                setEditingId(null);
                setShowAddForm(true);
              }}
            >
              塔婆を追加
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {showAddForm && (
          <div className="rounded-lg border border-border bg-muted/40 p-4">
            <h3 className="mb-3 text-base font-semibold text-foreground">
              塔婆を追加
            </h3>
            <TobaForm
              action={createTobaAction}
              submitLabel="登録する"
              memorialServiceId={memorialServiceId}
              targetPersons={targetPersons}
              onSaved={() => handleSaved('塔婆申込を登録しました')}
              onCancel={() => setShowAddForm(false)}
            />
          </div>
        )}

        {tobas.length === 0 && !showAddForm ? (
          <EmptyState
            title="塔婆申込はまだありません"
            description="「塔婆を追加」から申込者・対象故人・本数・表記をご登録ください。"
          />
        ) : (
          <>
            {/* PC: テーブル表示 */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">順</TableHead>
                    <TableHead>表記 / 申込者</TableHead>
                    <TableHead>対象故人</TableHead>
                    <TableHead className="w-20">本数</TableHead>
                    <TableHead className="w-28">御布施</TableHead>
                    <TableHead className="w-[220px] text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tobas.map((t, i) => (
                    <TobaTableRow
                      key={t.id}
                      toba={t}
                      index={i}
                      total={tobas.length}
                      isEditing={editingId === t.id}
                      isPending={isPending}
                      memorialServiceId={memorialServiceId}
                      targetPersons={targetPersons}
                      onMove={handleMove}
                      onEdit={() => {
                        setShowAddForm(false);
                        setEditingId(t.id);
                      }}
                      onCancelEdit={() => setEditingId(null)}
                      onSaved={() => handleSaved('塔婆申込を更新しました')}
                      onDelete={() => handleDelete(t.id)}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* スマホ: カード表示 */}
            <div className="space-y-3 md:hidden">
              {tobas.map((t, i) => (
                <TobaMobileCard
                  key={t.id}
                  toba={t}
                  index={i}
                  total={tobas.length}
                  isEditing={editingId === t.id}
                  isPending={isPending}
                  memorialServiceId={memorialServiceId}
                  targetPersons={targetPersons}
                  onMove={handleMove}
                  onEdit={() => {
                    setShowAddForm(false);
                    setEditingId(t.id);
                  }}
                  onCancelEdit={() => setEditingId(null)}
                  onSaved={() => handleSaved('塔婆申込を更新しました')}
                  onDelete={() => handleDelete(t.id)}
                />
              ))}
            </div>
          </>
        )}
      </CardContent>

      <ConfirmDialog
        {...confirm.props}
        title="塔婆申込を削除しますか？"
        description="この操作は取り消せません。読上帳からも除かれます。"
        confirmLabel="削除する"
        destructive
      />
    </Card>
  );
}

type RowProps = {
  toba: TobaListItem;
  index: number;
  total: number;
  isEditing: boolean;
  isPending: boolean;
  memorialServiceId: string;
  targetPersons: TargetPersonOption[];
  onMove: (id: string, dir: 'up' | 'down') => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSaved: () => void;
  onDelete: () => void;
};

function OrderButtons({
  index,
  total,
  isPending,
  onMove,
}: {
  index: number;
  total: number;
  isPending: boolean;
  onMove: (dir: 'up' | 'down') => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="secondary"
        size="icon"
        aria-label="読上順を上へ"
        disabled={index === 0 || isPending}
        onClick={() => onMove('up')}
      >
        <span aria-hidden="true">↑</span>
      </Button>
      <Button
        variant="secondary"
        size="icon"
        aria-label="読上順を下へ"
        disabled={index === total - 1 || isPending}
        onClick={() => onMove('down')}
      >
        <span aria-hidden="true">↓</span>
      </Button>
    </div>
  );
}

function EditForm({
  toba,
  memorialServiceId,
  targetPersons,
  onSaved,
  onCancelEdit,
}: {
  toba: TobaListItem;
  memorialServiceId: string;
  targetPersons: TargetPersonOption[];
  onSaved: () => void;
  onCancelEdit: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-4">
      <TobaForm
        action={updateTobaAction}
        submitLabel="更新する"
        memorialServiceId={memorialServiceId}
        targetPersons={targetPersons}
        tobaId={toba.id}
        initialValues={{
          applicantName: toba.applicantName,
          targetPersonId: toba.targetPersonId ?? '',
          count: String(toba.count),
          inscription: toba.inscription,
          offeringAmount:
            toba.offeringAmount !== null ? String(toba.offeringAmount) : '',
          memo: toba.memo ?? '',
        }}
        onSaved={onSaved}
        onCancel={onCancelEdit}
      />
    </div>
  );
}

function TobaTableRow(props: RowProps) {
  const {
    toba,
    index,
    total,
    isEditing,
    isPending,
    memorialServiceId,
    targetPersons,
    onMove,
    onEdit,
    onCancelEdit,
    onSaved,
    onDelete,
  } = props;

  if (isEditing) {
    return (
      <TableRow>
        <TableCell colSpan={6} className="bg-muted/20">
          <EditForm
            toba={toba}
            memorialServiceId={memorialServiceId}
            targetPersons={targetPersons}
            onSaved={onSaved}
            onCancelEdit={onCancelEdit}
          />
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow>
      <TableCell>
        <Badge variant="neutral" showIcon={false}>
          {index + 1}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="font-medium text-foreground">{toba.inscription}</div>
        <div className="text-sm text-muted-foreground">
          申込: {toba.applicantName}
        </div>
        {toba.memo && (
          <div className="mt-0.5 text-sm text-muted-foreground">{toba.memo}</div>
        )}
      </TableCell>
      <TableCell className="text-sm">
        {toba.targetPersonName ?? <span className="text-muted-foreground">—</span>}
      </TableCell>
      <TableCell>{toba.count} 本</TableCell>
      <TableCell className="text-sm">
        {toba.offeringAmount !== null ? (
          `${toba.offeringAmount.toLocaleString('ja-JP')} 円`
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-1">
          <OrderButtons
            index={index}
            total={total}
            isPending={isPending}
            onMove={(dir) => onMove(toba.id, dir)}
          />
          <Button variant="ghost" size="sm" onClick={onEdit}>
            編集
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} className="text-danger">
            削除
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function TobaMobileCard(props: RowProps) {
  const {
    toba,
    index,
    total,
    isEditing,
    isPending,
    memorialServiceId,
    targetPersons,
    onMove,
    onEdit,
    onCancelEdit,
    onSaved,
    onDelete,
  } = props;

  if (isEditing) {
    return (
      <EditForm
        toba={toba}
        memorialServiceId={memorialServiceId}
        targetPersons={targetPersons}
        onSaved={onSaved}
        onCancelEdit={onCancelEdit}
      />
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="neutral" showIcon={false}>
            {index + 1}
          </Badge>
          <span className="text-sm text-muted-foreground">{toba.count} 本</span>
        </div>
        <OrderButtons
          index={index}
          total={total}
          isPending={isPending}
          onMove={(dir) => onMove(toba.id, dir)}
        />
      </div>
      <div className="mt-2 font-medium text-foreground">{toba.inscription}</div>
      <dl className="mt-2 space-y-1 text-sm">
        <div className="flex gap-2">
          <dt className="text-muted-foreground">申込者</dt>
          <dd>{toba.applicantName}</dd>
        </div>
        {toba.targetPersonName && (
          <div className="flex gap-2">
            <dt className="text-muted-foreground">対象故人</dt>
            <dd>{toba.targetPersonName}</dd>
          </div>
        )}
        {toba.offeringAmount !== null && (
          <div className="flex gap-2">
            <dt className="text-muted-foreground">御布施</dt>
            <dd>{toba.offeringAmount.toLocaleString('ja-JP')} 円</dd>
          </div>
        )}
        {toba.memo && (
          <div className="flex gap-2">
            <dt className="text-muted-foreground">備考</dt>
            <dd>{toba.memo}</dd>
          </div>
        )}
      </dl>
      <div className="mt-3 flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={onEdit}>
          編集
        </Button>
        <Button variant="secondary" size="sm" onClick={onDelete} className="text-danger">
          削除
        </Button>
      </div>
    </div>
  );
}
