import Link from 'next/link';
import { Card } from '@/components/ui';
import { cn } from '@/lib/utils';

export type StatTone = 'default' | 'positive' | 'attention';

export type StatCardConfig = {
  key: string;
  /** カード見出し (日本語・丁寧語) */
  label: string;
  /** 主要な数値・金額 */
  value: string;
  /** 補足説明 (任意) */
  hint?: string;
  /** 遷移先 (任意)。指定時はカード全体がリンクになる。 */
  href?: string;
  tone?: StatTone;
};

const toneValueClass: Record<StatTone, string> = {
  default: 'text-foreground',
  positive: 'text-success',
  attention: 'text-warning',
};

/**
 * 数値・金額をひとつ強調表示する統計カード。
 * config (StatCardConfig) を流し込むだけで描画でき、画面側のハードコードを排除する。
 */
export function StatCard({ config }: { config: StatCardConfig }) {
  const tone = config.tone ?? 'default';
  const inner = (
    <>
      <p className="text-sm font-medium text-muted-foreground">{config.label}</p>
      <p className={cn('mt-2 text-3xl font-bold', toneValueClass[tone])}>
        {config.value}
      </p>
      {config.hint && (
        <p className="mt-1 text-sm text-muted-foreground">{config.hint}</p>
      )}
    </>
  );

  if (config.href) {
    return (
      <Card className="transition-colors hover:border-foreground/30 hover:shadow-md">
        <Link href={config.href} className="block px-5 py-4">
          {inner}
        </Link>
      </Card>
    );
  }

  return <Card className="px-5 py-4">{inner}</Card>;
}

export function StatCardGrid({ items }: { items: StatCardConfig[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <StatCard key={item.key} config={item} />
      ))}
    </div>
  );
}
