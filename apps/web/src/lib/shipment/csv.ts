/**
 * 宛名 CSV の組み立て (純関数)。
 *
 * 外部の差込印刷ソフト (Word 差込・年賀状ソフト等) で読み込める汎用 CSV を作る。
 * - 区切りはカンマ、改行は CRLF (Excel/Windows 互換)
 * - ダブルクォート・カンマ・改行を含むセルは RFC 4180 に従い "" でエスケープ
 * - BOM は付けない (呼び出し側が必要なら付与する)
 */

export type AddressCsvRow = {
  householderName: string;
  postalCode: string | null;
  address: string | null;
  summary: string | null;
};

export const ADDRESS_CSV_HEADER = ['宛名', '敬称', '郵便番号', '住所', '摘要'] as const;

/** 1 セルを RFC 4180 でエスケープする。 */
export function escapeCsvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toRow(cells: readonly string[]): string {
  return cells.map(escapeCsvCell).join(',');
}

/**
 * 宛先配列を宛名 CSV 文字列 (CRLF 区切り) に変換する。
 * 敬称は寺院の案内なので一律「様」を入れる。
 */
export function buildAddressCsv(rows: readonly AddressCsvRow[]): string {
  const lines: string[] = [toRow(ADDRESS_CSV_HEADER)];
  for (const r of rows) {
    lines.push(
      toRow([
        r.householderName,
        '様',
        r.postalCode ?? '',
        r.address ?? '',
        r.summary ?? '',
      ]),
    );
  }
  return lines.join('\r\n');
}
