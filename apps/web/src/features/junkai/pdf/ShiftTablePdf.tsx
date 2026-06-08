import 'server-only';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { formatWareki, seirekiToWareki } from '@/lib/wareki';
import {
  PDF_FONT_FAMILY,
  ensurePdfFontRegistered,
} from '@/features/nenki/pdf/font';

// PDF_FONT_FAMILY を使うにはモジュール読込時に register されている必要がある。
// 新規フォント登録はせず nenki の font.ts をそのまま再利用する。
ensurePdfFontRegistered();

export type ShiftTableStop = {
  order: number;
  name: string;
  statusLabel: string;
  memo: string | null;
};

export type ShiftTableTour = {
  scheduledDate: Date;
  title: string;
  tourTypeLabel: string;
  assigneeName: string | null;
  statusLabel: string;
  stops: ShiftTableStop[];
};

export type ShiftTableData = {
  templeName: string;
  year: number;
  month: number;
  issuedAt: Date;
  tours: ShiftTableTour[];
};

function formatIssuedDate(d: Date): string {
  try {
    const wareki = seirekiToWareki({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
    });
    return formatWareki(wareki);
  } catch {
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  }
}

/** @db.Date (UTC0時保存) を JST 基準の M月D日 で整形する (getUTC* で読む)。 */
function formatScheduledDate(d: Date): string {
  return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
}

const styles = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT_FAMILY,
    fontSize: 10,
    paddingTop: 40,
    paddingHorizontal: 44,
    paddingBottom: 40,
    lineHeight: 1.6,
    color: '#111827',
  },
  templeName: {
    textAlign: 'center',
    fontSize: 14,
    marginBottom: 2,
  },
  title: {
    textAlign: 'center',
    fontSize: 18,
    marginBottom: 16,
    letterSpacing: 3,
  },
  issuedDate: {
    textAlign: 'right',
    fontSize: 10,
    marginBottom: 14,
  },
  tourBlock: {
    marginBottom: 14,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderWidth: 0.5,
    borderColor: '#9CA3AF',
  },
  tourHeading: {
    fontSize: 12,
    marginBottom: 2,
  },
  tourMeta: {
    fontSize: 10,
    color: '#4B5563',
    marginBottom: 6,
  },
  stopRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  stopOrder: {
    width: 22,
    color: '#4B5563',
  },
  stopName: {
    flex: 1,
  },
  stopStatus: {
    width: 70,
    textAlign: 'right',
    color: '#4B5563',
  },
  stopMemo: {
    marginLeft: 22,
    fontSize: 9,
    color: '#6B7280',
  },
  emptyStops: {
    fontSize: 9,
    color: '#6B7280',
  },
});

function TourBlock({ tour }: { tour: ShiftTableTour }) {
  return (
    <View style={styles.tourBlock} wrap={false}>
      <Text style={styles.tourHeading}>
        {formatScheduledDate(tour.scheduledDate)}　{tour.title}（
        {tour.tourTypeLabel}）
      </Text>
      <Text style={styles.tourMeta}>
        担当: {tour.assigneeName ?? '（未割当）'}　状況: {tour.statusLabel}
      </Text>
      {tour.stops.length === 0 ? (
        <Text style={styles.emptyStops}>（訪問先未登録）</Text>
      ) : (
        tour.stops.map((s) => (
          <View key={s.order}>
            <View style={styles.stopRow}>
              <Text style={styles.stopOrder}>{s.order}.</Text>
              <Text style={styles.stopName}>{s.name}</Text>
              <Text style={styles.stopStatus}>{s.statusLabel}</Text>
            </View>
            {s.memo && <Text style={styles.stopMemo}>{s.memo}</Text>}
          </View>
        ))
      )}
    </View>
  );
}

export function ShiftTablePdf({ data }: { data: ShiftTableData }) {
  const issuedDate = formatIssuedDate(data.issuedAt);
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.templeName}>{data.templeName}</Text>
        <Text style={styles.title}>
          {data.year}年{data.month}月 巡回シフト表
        </Text>
        <Text style={styles.issuedDate}>{issuedDate} 発行</Text>
        {data.tours.map((t, i) => (
          <TourBlock key={i} tour={t} />
        ))}
      </Page>
    </Document>
  );
}
