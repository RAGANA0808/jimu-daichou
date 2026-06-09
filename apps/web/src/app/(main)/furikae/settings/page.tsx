import Link from 'next/link';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
} from '@/components/ui';
import {
  getPostalTransferAccount,
  listAllSubjects,
} from '@/features/postal-transfer/queries';
import { AMOUNT_SOURCE_LABELS } from '@/features/postal-transfer/types';
import { formatYen } from '@/features/postal-transfer/format';
import { AccountForm } from '@/features/postal-transfer/AccountForm';
import { SubjectForm } from '@/features/postal-transfer/SubjectForm';
import { deactivateSubjectAction } from '@/features/postal-transfer/actions';

export default async function FurikaeSettingsPage() {
  const [account, subjects] = await Promise.all([
    getPostalTransferAccount(),
    listAllSubjects(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="郵便振替の設定"
        description="科目テンプレートと寺の口座情報を設定します。"
        breadcrumbs={[
          { label: 'ダッシュボード', href: '/dashboard' },
          { label: '郵便振替', href: '/furikae' },
          { label: '設定' },
        ]}
        actions={
          <Link href="/furikae">
            <Button variant="secondary">振替用紙の作成へ</Button>
          </Link>
        }
      />

      {/* 科目一覧 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">科目テンプレート</CardTitle>
        </CardHeader>
        <CardContent>
          {subjects.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              科目がまだありません。下のフォームから追加してください。
            </p>
          ) : (
            <ul className="space-y-2">
              {subjects.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">
                        {s.name}
                      </span>
                      {!s.isActive && (
                        <Badge variant="neutral">休止中</Badge>
                      )}
                      {!s.isVisible && s.isActive && (
                        <Badge variant="neutral">非表示</Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      既定 {formatYen(s.defaultAmount)}
                      {s.amountSource !== 'NONE' &&
                        ` ／ ${AMOUNT_SOURCE_LABELS[s.amountSource]}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/furikae/settings/${s.id}`}>
                      <Button variant="secondary" size="sm">
                        編集
                      </Button>
                    </Link>
                    {s.isActive && (
                      <form action={deactivateSubjectAction}>
                        <input type="hidden" name="subjectId" value={s.id} />
                        <Button variant="ghost" size="sm" type="submit">
                          休止
                        </Button>
                      </form>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* 科目追加フォーム */}
      <SubjectForm />

      {/* 口座情報 */}
      <AccountForm account={account} />
    </div>
  );
}
