/**
 * 世帯 (Household) + 家族構成員 (Person) のエクスポート定義。
 *
 * 列はインポート (lib/import/entities/household) と同じキー・ラベルを使い、
 * エクスポート → 編集 → 再インポートの往復を可能にする。
 * 家族構成員は「氏名:ふりがな:続柄」を「；」区切りで 1 セルへ畳む
 * (インポートの parseFamilyMembers が受ける形)。
 */

import { blankIfNull } from '../format';
import type { EntityExportDef, ExportColumn } from '../types';

const COLUMNS: ExportColumn[] = [
  { key: 'householderName', label: '施主名' },
  { key: 'nameKana', label: 'ふりがな' },
  { key: 'postalCode', label: '郵便番号' },
  { key: 'address', label: '住所' },
  { key: 'phone', label: '電話番号' },
  { key: 'mobile', label: '携帯電話' },
  { key: 'email', label: 'メールアドレス' },
  { key: 'secondaryContact', label: '第2連絡先' },
  { key: 'memo', label: '備考' },
  { key: 'familyMembers', label: '家族構成員' },
];

/** 家族構成員 (存命) を「氏名:ふりがな:続柄」を「；」区切りで 1 セルへ畳む。 */
export function formatFamilyMembers(
  persons: { name: string; nameKana: string; familyRelation: string | null; isDeceased: boolean }[],
): string {
  return persons
    .filter((p) => !p.isDeceased)
    .map((p) => [p.name, p.nameKana, p.familyRelation ?? ''].join(':'))
    .join('；');
}

export const householdExportDef: EntityExportDef = {
  id: 'household',
  label: '世帯 (檀信徒)',
  description: '世帯と家族構成員を CSV / Excel で書き出します。家族構成員は1つのセルにまとめます。',
  fileBaseName: 'households',
  sheetName: '世帯',
  columns: COLUMNS,
  filterKind: 'none',

  async fetchRows(tx, _tenantId, _filter) {
    // RLS により withTenant 配下では自テナントの世帯のみ見える。
    // persons を include して N+1 を避ける。
    const households = await tx.household.findMany({
      where: { isActive: true },
      include: {
        persons: {
          select: { name: true, nameKana: true, familyRelation: true, isDeceased: true },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: [{ nameKana: 'asc' }, { householderName: 'asc' }],
    });

    return households.map((h) => ({
      householderName: h.householderName,
      nameKana: h.nameKana,
      postalCode: blankIfNull(h.postalCode),
      address: blankIfNull(h.address),
      phone: blankIfNull(h.phone),
      mobile: blankIfNull(h.mobile),
      email: blankIfNull(h.email),
      secondaryContact: blankIfNull(h.secondaryContact),
      memo: blankIfNull(h.memo),
      familyMembers: formatFamilyMembers(h.persons),
    }));
  },
};
