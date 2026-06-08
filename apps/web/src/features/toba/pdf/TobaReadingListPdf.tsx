import 'server-only';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { PDF_FONT_FAMILY, ensurePdfFontRegistered } from '@/features/nenki/pdf/font';

// PDF_FONT_FAMILY を使うにはモジュール読込時に register されている必要がある。
ensurePdfFontRegistered();

export type TobaReadingListItem = {
  order: number; // 読上順 (1 始まり)
  inscription: string; // 表記文字列 (読み上げる本文)
  applicantName: string;
  targetPersonName: string | null;
  count: number;
};

export type TobaReadingListData = {
  templeName: string;
  serviceName: string;
  householderName: string;
  scheduledAt: Date;
  issuedAt: Date;
  items: TobaReadingListItem[];
};

function formatJaDate(d: Date): string {
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function formatJaDateTime(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${formatJaDate(d)} ${hh}:${mm}`;
}

const styles = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT_FAMILY,
    fontSize: 12,
    paddingTop: 44,
    paddingHorizontal: 52,
    paddingBottom: 44,
    lineHeight: 1.6,
    color: '#111827',
  },
  templeName: {
    textAlign: 'center',
    fontSize: 14,
    marginBottom: 2,
    color: '#4B5563',
  },
  title: {
    textAlign: 'center',
    fontSize: 22,
    marginBottom: 16,
    letterSpacing: 6,
  },
  metaBlock: {
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#9CA3AF',
  },
  metaRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  metaLabel: {
    width: 64,
    color: '#4B5563',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E7EB',
  },
  orderNo: {
    width: 34,
    fontSize: 16,
  },
  itemBody: {
    flex: 1,
  },
  inscription: {
    fontSize: 16,
    marginBottom: 2,
  },
  sub: {
    fontSize: 10,
    color: '#4B5563',
  },
  countCol: {
    width: 46,
    textAlign: 'right',
    fontSize: 12,
  },
  footer: {
    marginTop: 18,
    textAlign: 'right',
    fontSize: 10,
    color: '#6B7280',
  },
  empty: {
    marginTop: 24,
    textAlign: 'center',
    color: '#9CA3AF',
  },
});

export function TobaReadingListPdf({ data }: { data: TobaReadingListData }) {
  const total = data.items.reduce((sum, i) => sum + i.count, 0);
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.templeName}>{data.templeName}</Text>
        <Text style={styles.title}>塔婆読上帳</Text>

        <View style={styles.metaBlock}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>法要</Text>
            <Text>{data.serviceName}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>施主</Text>
            <Text>{data.householderName} 家</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>日時</Text>
            <Text>{formatJaDateTime(data.scheduledAt)}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>塔婆</Text>
            <Text>
              {data.items.length} 件 / {total} 本
            </Text>
          </View>
        </View>

        {data.items.length === 0 ? (
          <Text style={styles.empty}>塔婆申込はありません。</Text>
        ) : (
          data.items.map((item) => (
            <View key={item.order} style={styles.item} wrap={false}>
              <Text style={styles.orderNo}>{item.order}.</Text>
              <View style={styles.itemBody}>
                <Text style={styles.inscription}>{item.inscription}</Text>
                <Text style={styles.sub}>
                  申込: {item.applicantName}
                  {item.targetPersonName
                    ? `   対象: ${item.targetPersonName}`
                    : ''}
                </Text>
              </View>
              <Text style={styles.countCol}>{item.count} 本</Text>
            </View>
          ))
        )}

        <Text style={styles.footer}>
          発行日: {formatJaDate(data.issuedAt)}
        </Text>
      </Page>
    </Document>
  );
}
