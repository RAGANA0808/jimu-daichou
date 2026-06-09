/**
 * 過去帳 (DeathLedgerEntry) のエクスポート定義。
 *
 * 列はインポート (lib/import/entities/deathLedger) と同じキー・ラベルを使う。
 * 没年月日は精度に応じて YYYY-MM-DD / YYYY-MM / YYYY へ整形する (再インポート互換)。
 * 論理削除 (deletedAt) されたエントリは書き出さない。
 * 紐付く世帯の施主名・ふりがなも添えて再インポート時の世帯解決を助ける。
 */

import { blankIfNull, formatDeathDate, formatIntCell } from '../format';
import type { EntityExportDef, ExportColumn, ExportFilter } from '../types';

const COLUMNS: ExportColumn[] = [
  { key: 'secularName', label: '俗名' },
  { key: 'nameKana', label: 'ふりがな' },
  { key: 'kaimyoName', label: '戒名' },
  { key: 'dateOfDeath', label: '没年月日' },
  { key: 'ageAtDeath', label: '行年' },
  { key: 'burialLocation', label: '埋葬場所' },
  { key: 'familyRelation', label: '続柄' },
  { key: 'householderName', label: '施主名' },
  { key: 'householderKana', label: '施主ふりがな' },
  { key: 'memo', label: '備考' },
];

/** 過去帳の没年フィルタを where 条件へ落とす純関数。 */
export function deathYearWhere(filter: ExportFilter): { gte?: number; lte?: number } | undefined {
  const cond: { gte?: number; lte?: number } = {};
  if (typeof filter.fromYear === 'number') cond.gte = filter.fromYear;
  if (typeof filter.toYear === 'number') cond.lte = filter.toYear;
  return Object.keys(cond).length > 0 ? cond : undefined;
}

export const deathLedgerExportDef: EntityExportDef = {
  id: 'death-ledger',
  label: '過去帳 (故人)',
  description:
    '過去帳の故人を CSV / Excel で書き出します。没年の期間で絞り込めます。除外 (論理削除) された記録は含みません。',
  fileBaseName: 'death-ledger',
  sheetName: '過去帳',
  columns: COLUMNS,
  filterKind: 'yearRange',

  async fetchRows(tx, _tenantId, filter) {
    const yearCond = deathYearWhere(filter);
    // RLS 配下。person + household を include して N+1 を避ける。
    const entries = await tx.deathLedgerEntry.findMany({
      where: {
        deletedAt: null,
        ...(yearCond ? { deathYear: yearCond } : {}),
      },
      include: {
        person: {
          select: {
            name: true,
            nameKana: true,
            familyRelation: true,
            household: { select: { householderName: true, nameKana: true } },
          },
        },
      },
      orderBy: [
        { deathYear: 'asc' },
        { deathMonth: 'asc' },
        { deathDay: 'asc' },
      ],
    });

    return entries.map((e) => ({
      secularName: e.secularName,
      nameKana: e.person.nameKana,
      kaimyoName: blankIfNull(e.kaimyoName),
      dateOfDeath: formatDeathDate({
        precision: e.datePrecision,
        year: e.deathYear,
        month: e.deathMonth,
        day: e.deathDay,
      }),
      ageAtDeath: formatIntCell(e.ageAtDeath),
      burialLocation: blankIfNull(e.burialLocation),
      familyRelation: blankIfNull(e.person.familyRelation),
      householderName: e.person.household.householderName,
      householderKana: e.person.household.nameKana,
      memo: blankIfNull(e.memo),
    }));
  },
};
