import 'server-only';
import { requireCurrentTenantId } from '@/lib/auth';
import { withTenant } from '@/lib/db';
import {
  findAnniversariesInYear,
  type Anniversary,
} from '@/lib/nenki';

export type AnniversaryMatch = {
  entryId: string;
  householdId: string;
  householdName: string;
  secularName: string;
  kaimyoName: string | null;
  ageAtDeath: number | null;
  /** 命日 (西暦) */
  deathDate: { year: number; month: number; day: number };
  anniversary: Anniversary;
};

/**
 * 指定年に年忌を迎える故人を抽出する。
 *
 * - 論理削除された過去帳エントリ (`deletedAt`) は除外
 * - 離檀世帯 (`Household.isActive=false`) の故人も除外 (案内状送付用のため)
 * - 並び順は法要予定日 (月→日) の昇順。月日不明は末尾
 */
export async function findAnniversariesForYear(
  year: number,
): Promise<AnniversaryMatch[]> {
  const tenantId = await requireCurrentTenantId();

  const entries = await withTenant(tenantId, (tx) =>
    tx.deathLedgerEntry.findMany({
      where: {
        deletedAt: null,
        person: { household: { isActive: true } },
      },
      include: {
        person: {
          select: {
            household: {
              select: { id: true, householderName: true },
            },
          },
        },
      },
    }),
  );

  const deceased = entries.map((e) => {
    const d = e.dateOfDeath;
    return {
      entryId: e.id,
      householdId: e.person.household.id,
      householdName: e.person.household.householderName,
      secularName: e.secularName,
      kaimyoName: e.kaimyoName,
      ageAtDeath: e.ageAtDeath,
      deathDate: {
        year: d.getUTCFullYear(),
        month: d.getUTCMonth() + 1,
        day: d.getUTCDate(),
      },
    };
  });

  const matched = findAnniversariesInYear(deceased, year);

  // 予定日の月日で昇順ソート (不明は末尾へ)
  return matched.sort((a, b) => {
    const ma = a.anniversary.month ?? 99;
    const mb = b.anniversary.month ?? 99;
    if (ma !== mb) return ma - mb;
    const da = a.anniversary.day ?? 99;
    const db = b.anniversary.day ?? 99;
    return da - db;
  });
}
