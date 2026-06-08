import { Badge } from '@/components/ui';
import { DocumentUploadForm } from './DocumentUploadForm';
import { DocumentRowActions } from './DocumentRowActions';
import type { DocumentListItem, DocumentTarget } from './types';

type Props = {
  target: DocumentTarget;
  documents: DocumentListItem[];
  /** アップロード可否 (create capability 由来)。 */
  canEdit: boolean;
  /** 除外可否 (softDelete/destructive capability 由来)。 */
  canDelete: boolean;
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTimestamp(d: Date): string {
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

type KindLabel = { label: string; variant: 'info' | 'warning' | 'neutral' };

function kindOf(mimeType: string): KindLabel {
  if (mimeType.startsWith('image/')) {
    return { label: '画像', variant: 'info' };
  }
  if (mimeType === 'application/pdf') {
    return { label: 'PDF', variant: 'warning' };
  }
  return { label: '文書', variant: 'neutral' };
}

export function DocumentSection({
  target,
  documents,
  canEdit,
  canDelete,
}: Props) {
  return (
    <div className="rounded border border-border bg-surface p-6">
      <div className="mb-4">
        <h2 className="text-lg font-medium">書類</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {documents.length === 0
            ? '関連する書類（写真・PDF・文書）をまだ登録していません。'
            : `登録件数: ${documents.length} 件（新しい順）`}
        </p>
      </div>

      {canEdit && (
        <DocumentUploadForm targetKind={target.kind} targetId={target.id} />
      )}

      {documents.length > 0 && (
        <>
          {/* PC: テーブル */}
          <div className="hidden overflow-hidden rounded border border-border sm:block">
            <table className="w-full divide-y divide-border text-sm">
              <thead className="bg-brand text-left text-xs uppercase tracking-wider text-brand-foreground">
                <tr>
                  <th className="px-4 py-2">書類名</th>
                  <th className="px-4 py-2">種類</th>
                  <th className="px-4 py-2">サイズ</th>
                  <th className="px-4 py-2">登録日</th>
                  <th className="px-4 py-2 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {documents.map((doc) => {
                  const kind = kindOf(doc.mimeType);
                  return (
                    <tr key={doc.id} className="hover:bg-muted">
                      <td className="px-4 py-2 font-medium text-foreground">
                        {doc.title}
                      </td>
                      <td className="px-4 py-2">
                        <Badge variant={kind.variant} showIcon={false}>
                          {kind.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-foreground">
                        {formatBytes(doc.byteSize)}
                      </td>
                      <td className="px-4 py-2 text-foreground">
                        {formatTimestamp(doc.createdAt)}
                      </td>
                      <td className="px-4 py-2">
                        <DocumentRowActions
                          documentId={doc.id}
                          canDelete={canDelete}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* スマホ: カード */}
          <ul className="space-y-3 sm:hidden">
            {documents.map((doc) => {
              const kind = kindOf(doc.mimeType);
              return (
                <li
                  key={doc.id}
                  className="rounded-lg border border-border bg-surface p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-medium text-foreground">
                      {doc.title}
                    </span>
                    <Badge variant={kind.variant} showIcon={false}>
                      {kind.label}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatBytes(doc.byteSize)}・{formatTimestamp(doc.createdAt)}
                  </p>
                  <div className="mt-3">
                    <DocumentRowActions
                      documentId={doc.id}
                      canDelete={canDelete}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
