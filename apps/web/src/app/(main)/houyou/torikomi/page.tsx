import Link from 'next/link';
import { Button, Card, CardContent, PageHeader } from '@/components/ui';
import { getCalendarImportData } from '@/features/calendar-import/queries';
import { CalendarImportForm } from '@/features/calendar-import/CalendarImportForm';

export default async function CalendarImportPage() {
  const data = await getCalendarImportData();

  return (
    <div className="space-y-4">
      <PageHeader
        title="Google カレンダーから取り込む"
        description="住職の Google カレンダーの予定を、寺務台帳の「寺の行事」として取り込めます。"
        breadcrumbs={[
          { label: 'ダッシュボード', href: '/dashboard' },
          { label: '法要', href: '/houyou' },
          { label: 'カレンダー取込' },
        ]}
      />

      {data.connected ? (
        <>
          <p className="text-sm text-muted-foreground">
            {data.rangeLabel} の予定を表示しています。
          </p>
          <CalendarImportForm events={data.events} />
        </>
      ) : (
        <Card>
          <CardContent className="space-y-3">
            <p className="text-sm text-foreground">
              現在 Google
              カレンダーと連携していません。連携すると、住職のカレンダーの予定をこの画面から取り込めます。
            </p>
            <Link href="/settings">
              <Button>設定で Google 連携を行う</Button>
            </Link>
            <p className="text-xs text-muted-foreground">
              ※
              自動同期は行いません。連携後、この画面で予定を選んで取り込みます。
            </p>
          </CardContent>
        </Card>
      )}

      <Link
        href="/houyou"
        className="inline-block text-sm text-info hover:underline"
      >
        ← 法要一覧に戻る
      </Link>
    </div>
  );
}
