/**
 * 会計 (Transaction) のインポート定義。
 *
 * 入出金台帳 (CSV / Excel) を取り込む。1 行 = 入出金 1 件。
 *
 * - 金額は 3 桁区切りカンマ・全角数字・「円」記号を許容して整数 (円) へ正規化する。
 * - direction (収入/支出) と category (護持会費/御布施/…) の整合を検証する。
 *   支出区分 (EXPENSE) を収入に付けるなど、明らかに矛盾する組合せはエラーにする。
 * - 対象世帯 (householdId) は任意。施主名 or 施主ふりがなの正規化一致で既存世帯へ解決し、
 *   未一致は警告のうえ世帯なし (寺側の経費等) として取り込む。
 *
 * すべてのクエリは withTenant + RLS 配下で行う。
 */

import type { Prisma, TransactionCategory, TransactionDirection } from '@prisma/client';
import { normalizeKana } from '@/lib/search/normalize';
import { normalizeSecularName } from '@/lib/kakochou';
import { parseDateCell } from '../date-cell';
import type {
  ColumnDef,
  EntityImportDef,
  ExistingKeyIndex,
  RowIssue,
} from '../types';

/** 確定時に Transaction を作る 1 行分のレコード。 */
export type TransactionImportRecord = {
  category: TransactionCategory;
  amount: number;
  direction: TransactionDirection;
  paidAt: Date;
  paymentMethod: string | null;
  householdId: string | null;
  memo: string | null;
};

/** 会計インポート用の照合コンテキスト。施主名・かな → householdId の名寄せ表を持つ。 */
export type TransactionExistingIndex = ExistingKeyIndex & {
  householdIdByMatchKey(key: string): string | null;
};

const COLUMNS: ColumnDef[] = [
  {
    key: 'direction',
    label: '入出金',
    required: true,
    hint: '収入 / 支出 のいずれか。',
    aliases: ['区分', '収支', '方向', 'direction', 'type'],
  },
  {
    key: 'category',
    label: '項目',
    required: true,
    hint: '護持会費 / 御布施 / 寄付 / 行事関連 / 経費 / その他。',
    aliases: ['カテゴリ', '勘定科目', '科目', '費目', 'category'],
  },
  {
    key: 'amount',
    label: '金額',
    required: true,
    hint: '円単位の整数。カンマ区切り (1,000) も取り込めます。',
    aliases: ['金額(円)', '額', '入金額', '出金額', 'amount', 'price'],
  },
  {
    key: 'paidAt',
    label: '入出金日',
    required: true,
    hint: '西暦・和暦の暦日 (例: 2024-03-15 / 令和6年3月15日)。',
    aliases: ['日付', '取引日', '入金日', '支払日', 'paidat', 'date'],
  },
  {
    key: 'paymentMethod',
    label: '支払方法',
    required: false,
    hint: '現金 / 振込 / その他 など。',
    aliases: ['決済方法', '入金方法', 'method', 'paymentmethod'],
  },
  {
    key: 'householderName',
    label: '対象世帯 (施主名)',
    required: false,
    hint: '対象の施主名。既存世帯と一致すれば紐づけ、無ければ世帯なしで取り込みます。',
    aliases: ['世帯', '施主', '対象者', '世帯主', 'householder', 'householdername'],
  },
  {
    key: 'householderKana',
    label: '対象世帯 (ふりがな)',
    required: false,
    aliases: ['施主かな', '世帯かな', 'householderkana'],
  },
  {
    key: 'memo',
    label: '備考',
    required: false,
    aliases: ['メモ', '摘要', '備考欄', '特記事項', 'note', 'memo', 'remarks'],
  },
];

const MAX_AMOUNT = 1_000_000_000; // 10 億円を上限とする安全ガード
const MAX_PAYMENT_METHOD = 40;

function nullIfBlank(value: string): string | null {
  const t = value.trim();
  return t.length === 0 ? null : t;
}

const DIRECTION_BY_LABEL: Record<string, TransactionDirection> = {
  収入: 'INCOME',
  入金: 'INCOME',
  収: 'INCOME',
  income: 'INCOME',
  支出: 'EXPENSE',
  出金: 'EXPENSE',
  支: 'EXPENSE',
  expense: 'EXPENSE',
};

const CATEGORY_BY_LABEL: Record<string, TransactionCategory> = {
  護持会費: 'MAINTENANCE_FEE',
  会費: 'MAINTENANCE_FEE',
  maintenance_fee: 'MAINTENANCE_FEE',
  御布施: 'OFFERING',
  布施: 'OFFERING',
  お布施: 'OFFERING',
  offering: 'OFFERING',
  寄付: 'DONATION',
  寄附: 'DONATION',
  donation: 'DONATION',
  行事関連: 'EVENT_FEE',
  行事: 'EVENT_FEE',
  event_fee: 'EVENT_FEE',
  経費: 'EXPENSE',
  支出: 'EXPENSE',
  expense: 'EXPENSE',
  その他: 'OTHER',
  other: 'OTHER',
};

/** 各方向で自然なカテゴリ (lib 内に閉じた整合ルール。features 側 UI と同じ意味)。 */
const CATEGORY_BY_DIRECTION: Record<TransactionDirection, TransactionCategory[]> = {
  INCOME: ['MAINTENANCE_FEE', 'OFFERING', 'DONATION', 'EVENT_FEE', 'OTHER'],
  EXPENSE: ['EXPENSE', 'EVENT_FEE', 'OTHER'],
};

function normalizeEnumKey(raw: string): string {
  return raw.trim().toLowerCase();
}

/** 金額文字列を整数 (円) へ正規化する。不正なら null。 */
function parseAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  // 全角数字 → 半角、カンマ・空白・「円」・「¥」「￥」を除去。
  const half = trimmed.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
  const cleaned = half.replace(/[,，\s円¥￥]/g, '');
  if (!/^\d+$/.test(cleaned)) return null;
  const n = Number.parseInt(cleaned, 10);
  if (Number.isNaN(n)) return null;
  return n;
}

export const transactionImportDef: EntityImportDef<
  TransactionImportRecord,
  TransactionExistingIndex
> = {
  id: 'transaction',
  label: '会計 (入出金)',
  description:
    '入出金台帳 (CSV / Excel) から会計記録を取り込みます。収入・支出の区分と項目の整合を確認し、施主名で対象世帯へ紐づけます。金額はカンマ区切りも取り込めます。',
  columns: COLUMNS,

  toRecord(values, ctx) {
    const issues: RowIssue[] = [];

    const directionRaw = (values.direction ?? '').trim();
    let direction: TransactionDirection | null = null;
    if (directionRaw.length === 0) {
      issues.push({ column: 'direction', severity: 'error', message: '入出金の区分が未入力です。' });
    } else {
      const resolved = DIRECTION_BY_LABEL[normalizeEnumKey(directionRaw)];
      if (!resolved) {
        issues.push({
          column: 'direction',
          severity: 'error',
          message: `入出金の区分「${directionRaw}」を認識できません。収入 / 支出 でご入力ください。`,
        });
      } else {
        direction = resolved;
      }
    }

    const categoryRaw = (values.category ?? '').trim();
    let category: TransactionCategory | null = null;
    if (categoryRaw.length === 0) {
      issues.push({ column: 'category', severity: 'error', message: '項目が未入力です。' });
    } else {
      const resolved = CATEGORY_BY_LABEL[normalizeEnumKey(categoryRaw)];
      if (!resolved) {
        issues.push({
          column: 'category',
          severity: 'error',
          message: `項目「${categoryRaw}」を認識できません。護持会費/御布施/寄付/行事関連/経費/その他 のいずれかでご入力ください。`,
        });
      } else {
        category = resolved;
      }
    }

    // direction と category の整合検証。
    if (direction !== null && category !== null) {
      if (!CATEGORY_BY_DIRECTION[direction].includes(category)) {
        issues.push({
          column: 'category',
          severity: 'error',
          message:
            direction === 'INCOME'
              ? '収入に「経費」は指定できません。項目をご確認ください。'
              : '支出に指定できる項目は 経費 / 行事関連 / その他 です。項目をご確認ください。',
        });
      }
    }

    const amount = parseAmount(values.amount ?? '');
    if (amount === null) {
      issues.push({ column: 'amount', severity: 'error', message: '金額を数値として読み取れませんでした。' });
    } else if (amount <= 0) {
      issues.push({ column: 'amount', severity: 'error', message: '金額は 1 円以上でご入力ください。' });
    } else if (amount > MAX_AMOUNT) {
      issues.push({ column: 'amount', severity: 'error', message: '金額が大きすぎます。ご確認ください。' });
    }

    let paidAt: Date | null = null;
    const parsedDate = parseDateCell(values.paidAt ?? '');
    if (!parsedDate.ok) {
      issues.push({
        column: 'paidAt',
        severity: 'error',
        message:
          parsedDate.error === 'incomplete_date'
            ? '入出金日は年月日をすべてご入力ください (例: 2024-03-15)。'
            : parsedDate.error === 'invalid_calendar_date'
              ? '実在しない入出金日です。'
              : '入出金日の形式を読み取れませんでした。',
      });
    } else if (parsedDate.value === null) {
      issues.push({ column: 'paidAt', severity: 'error', message: '入出金日が未入力です。' });
    } else {
      paidAt = parsedDate.value;
    }

    const paymentMethod = (values.paymentMethod ?? '').trim();
    if (paymentMethod.length > MAX_PAYMENT_METHOD) {
      issues.push({
        column: 'paymentMethod',
        severity: 'error',
        message: '支払方法が40文字を超えています。',
      });
    }

    // 対象世帯解決 (任意)。未一致は警告のうえ世帯なしで取り込む。
    const householderName = (values.householderName ?? '').trim();
    const householderKana = (values.householderKana ?? '').trim();
    let householdId: string | null = null;
    if (householderName.length > 0 || householderKana.length > 0) {
      const nameKey =
        householderName.length > 0 ? `name:${normalizeSecularName(householderName)}` : '';
      const kanaKey = householderKana.length > 0 ? `kana:${normalizeKana(householderKana)}` : '';
      householdId =
        (nameKey.length > 0 ? ctx.existing.householdIdByMatchKey(nameKey) : null) ??
        (kanaKey.length > 0 ? ctx.existing.householdIdByMatchKey(kanaKey) : null);
      if (householdId === null) {
        issues.push({
          column: 'householderName',
          severity: 'warning',
          message: `対象世帯「${householderName || householderKana}」が見つかりません。世帯なしで取り込みます。`,
        });
      }
    }

    const hasError = issues.some((i) => i.severity === 'error');
    if (hasError || direction === null || category === null || amount === null || paidAt === null) {
      return { issues, record: null };
    }

    const record: TransactionImportRecord = {
      direction,
      category,
      amount,
      paidAt,
      paymentMethod: nullIfBlank(paymentMethod),
      householdId,
      memo: nullIfBlank(values.memo ?? ''),
    };
    return { issues, record };
  },

  async loadExistingKeys(tx, _tenantId): Promise<TransactionExistingIndex> {
    // RLS により withTenant 配下では自テナントのみ見える。
    const households = await tx.household.findMany({
      where: { isActive: true },
      select: { id: true, householderName: true, nameKana: true },
    });
    const householdMap = new Map<string, string>();
    for (const h of households) {
      const nk = normalizeSecularName(h.householderName);
      if (nk.length > 0 && !householdMap.has(`name:${nk}`)) householdMap.set(`name:${nk}`, h.id);
      const kk = normalizeKana(h.nameKana);
      if (kk.length > 0 && !householdMap.has(`kana:${kk}`)) householdMap.set(`kana:${kk}`, h.id);
    }
    return {
      // 会計は同一性で除外する重複概念を持たない (同額・同日の入金は正当にありうる)。
      has: () => false,
      householdIdByMatchKey: (key) => householdMap.get(key) ?? null,
    };
  },

  async insertBatch(tx, tenantId, records): Promise<number> {
    const data: Prisma.TransactionCreateManyInput[] = records.map((rec) => ({
      tenantId,
      category: rec.category,
      amount: rec.amount,
      direction: rec.direction,
      paidAt: rec.paidAt,
      paymentMethod: rec.paymentMethod,
      householdId: rec.householdId,
      memo: rec.memo,
    }));
    if (data.length === 0) return 0;
    const result = await tx.transaction.createMany({ data });
    return result.count;
  },
};
