import 'server-only';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { formatWareki, seirekiToWareki } from '@/lib/wareki';
import {
  PDF_FONT_FAMILY,
  ensurePdfFontRegistered,
} from '@/features/nenki/pdf/font';

// PDF_FONT_FAMILY を使うにはモジュール読込時に register されている必要がある。
ensurePdfFontRegistered();

export type ChuinTableRow = {
  /** 表示名。例: "初七日" */
  name: string;
  /** 別称。例: "満中陰"。無ければ null */
  altName: string | null;
  year: number;
  month: number;
  day: number;
};

export type ChuinTableData = {
  issuedAt: Date;
  temple: {
    name: string;
    headPriestName: string | null;
  };
  deceased: {
    secularName: string;
    kaimyoName: string | null;
    deathYear: number;
    deathMonth: number;
    deathDay: number;
  };
  rows: ChuinTableRow[];
};

function formatSeirekiAndWareki(year: number, month: number, day: number): string {
  const seireki = `${year}年${month}月${day}日`;
  try {
    const wareki = seirekiToWareki({ year, month, day });
    return `${seireki}（${formatWareki(wareki)}）`;
  } catch {
    return seireki;
  }
}

function formatIssuedDate(d: Date): string {
  return formatSeirekiAndWareki(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

const styles = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT_FAMILY,
    fontSize: 11,
    paddingTop: 48,
    paddingHorizontal: 56,
    paddingBottom: 48,
    lineHeight: 1.7,
    color: '#111827',
  },
  templeName: {
    textAlign: 'center',
    fontSize: 16,
    marginBottom: 4,
  },
  title: {
    textAlign: 'center',
    fontSize: 20,
    marginBottom: 28,
    letterSpacing: 4,
  },
  issuedDate: {
    textAlign: 'right',
    marginBottom: 16,
    fontSize: 10,
    color: '#4B5563',
  },
  deceasedBlock: {
    marginBottom: 20,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 0.5,
    borderColor: '#9CA3AF',
  },
  deceasedRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  label: {
    width: 64,
    color: '#4B5563',
  },
  table: {
    borderWidth: 0.5,
    borderColor: '#9CA3AF',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderBottomWidth: 0.5,
    borderBottomColor: '#9CA3AF',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E7EB',
  },
  colName: {
    width: '34%',
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  colDate: {
    width: '66%',
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  headerCell: {
    fontSize: 10,
    color: '#374151',
  },
  cellName: {
    fontSize: 12,
  },
  cellAlt: {
    fontSize: 9,
    color: '#6B7280',
  },
  note: {
    marginTop: 18,
    fontSize: 9,
    color: '#6B7280',
  },
  closingBlock: {
    marginTop: 28,
    alignItems: 'flex-end',
  },
  signature: {
    marginTop: 2,
  },
});

export function ChuinTablePdf({ data }: { data: ChuinTableData }) {
  const { deceased } = data;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.templeName}>{data.temple.name}</Text>
        <Text style={styles.title}>中陰表</Text>

        <Text style={styles.issuedDate}>{formatIssuedDate(data.issuedAt)} 作成</Text>

        <View style={styles.deceasedBlock}>
          <View style={styles.deceasedRow}>
            <Text style={styles.label}>俗名</Text>
            <Text>{deceased.secularName}</Text>
          </View>
          {deceased.kaimyoName && (
            <View style={styles.deceasedRow}>
              <Text style={styles.label}>戒名</Text>
              <Text>{deceased.kaimyoName}</Text>
            </View>
          )}
          <View style={styles.deceasedRow}>
            <Text style={styles.label}>命日</Text>
            <Text>
              {formatSeirekiAndWareki(
                deceased.deathYear,
                deceased.deathMonth,
                deceased.deathDay,
              )}
            </Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.colName, styles.headerCell]}>忌日</Text>
            <Text style={[styles.colDate, styles.headerCell]}>
              当日（西暦・和暦併記）
            </Text>
          </View>
          {data.rows.map((row, i) => (
            <View key={i} style={styles.tableRow}>
              <View style={styles.colName}>
                <Text style={styles.cellName}>{row.name}</Text>
                {row.altName && (
                  <Text style={styles.cellAlt}>（{row.altName}）</Text>
                )}
              </View>
              <Text style={[styles.colDate, styles.cellName]}>
                {formatSeirekiAndWareki(row.year, row.month, row.day)}
              </Text>
            </View>
          ))}
        </View>

        <Text style={styles.note}>
          ※ 命日を一日目と数え、初七日は命日から七日目、四十九日（満中陰）は四十九日目、
          百ヶ日は百日目として算出しています。
        </Text>

        <View style={styles.closingBlock}>
          <Text style={styles.signature}>{data.temple.name}</Text>
          {data.temple.headPriestName && (
            <Text style={styles.signature}>住職 {data.temple.headPriestName}</Text>
          )}
        </View>
      </Page>
    </Document>
  );
}
