import 'server-only';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { formatWareki, seirekiToWareki } from '@/lib/wareki';
import {
  PDF_FONT_FAMILY,
  ensurePdfFontRegistered,
} from '@/features/nenki/pdf/font';

ensurePdfFontRegistered();

export type DunningRecipient = {
  householdId: string;
  householderName: string;
  postalCode: string | null;
  address: string | null;
  amount: number;
  paidAmount: number;
  outstanding: number;
};

export type DunningLetterData = {
  issuedAt: Date;
  fiscalYear: number;
  temple: { name: string; headPriestName: string | null };
  /** 納入期限 (任意・自由記述)。 */
  dueNote: string | null;
  /** 本文への追記 (任意)。 */
  bodyNote: string | null;
  recipients: DunningRecipient[];
};

function formatWarekiSafe(d: Date): string {
  try {
    return formatWareki(
      seirekiToWareki({
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        day: d.getDate(),
      }),
    );
  } catch {
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  }
}

function formatYen(n: number): string {
  return `${n.toLocaleString('ja-JP')} 円`;
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
  templeName: { textAlign: 'center', fontSize: 16, marginBottom: 4 },
  title: {
    textAlign: 'center',
    fontSize: 20,
    marginBottom: 28,
    letterSpacing: 4,
  },
  issuedDate: { textAlign: 'right', marginBottom: 16 },
  recipientBlock: { marginBottom: 22 },
  postal: { fontSize: 10, color: '#4B5563' },
  address: { fontSize: 11, marginBottom: 6 },
  recipientName: { fontSize: 14 },
  paragraph: { marginBottom: 10 },
  detailBox: {
    marginVertical: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 0.5,
    borderColor: '#9CA3AF',
  },
  detailRow: { flexDirection: 'row', marginBottom: 4 },
  detailLabel: { width: 96, color: '#4B5563' },
  detailValue: { flex: 1 },
  closingBlock: { marginTop: 24, alignItems: 'flex-end' },
  signature: { marginTop: 4 },
});

function DunningPage({
  recipient,
  data,
  issuedDate,
}: {
  recipient: DunningRecipient;
  data: DunningLetterData;
  issuedDate: string;
}) {
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.templeName}>{data.temple.name}</Text>
      <Text style={styles.title}>護持会費 納入のお願い</Text>
      <Text style={styles.issuedDate}>{issuedDate}</Text>

      <View style={styles.recipientBlock}>
        {recipient.postalCode && (
          <Text style={styles.postal}>〒 {recipient.postalCode}</Text>
        )}
        {recipient.address && (
          <Text style={styles.address}>{recipient.address}</Text>
        )}
        <Text style={styles.recipientName}>{recipient.householderName} 様</Text>
      </View>

      <Text style={styles.paragraph}>
        拝啓 時下ますますご清祥のこととお慶び申し上げます。平素より当山の護持運営に格別のご高配を賜り、厚く御礼申し上げます。
      </Text>
      <Text style={styles.paragraph}>
        さて、{data.fiscalYear} 年度の護持会費につきまして、下記のとおり未納分がございます。ご多用のところ恐れ入りますが、ご確認のうえご納入くださいますようお願い申し上げます。
      </Text>

      <View style={styles.detailBox}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>対象年度</Text>
          <Text style={styles.detailValue}>{data.fiscalYear} 年度</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>年額会費</Text>
          <Text style={styles.detailValue}>{formatYen(recipient.amount)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>納入済額</Text>
          <Text style={styles.detailValue}>
            {formatYen(recipient.paidAmount)}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>未納額</Text>
          <Text style={styles.detailValue}>
            {formatYen(recipient.outstanding)}
          </Text>
        </View>
        {data.dueNote && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>納入期限</Text>
            <Text style={styles.detailValue}>{data.dueNote}</Text>
          </View>
        )}
      </View>

      {data.bodyNote && <Text style={styles.paragraph}>{data.bodyNote}</Text>}

      <Text style={styles.paragraph}>
        なお、行き違いにてご納入済みの場合は、何卒ご容赦くださいますようお願い申し上げます。
      </Text>

      <View style={styles.closingBlock}>
        <Text>敬具</Text>
        <Text style={styles.signature}>{data.temple.name}</Text>
        {data.temple.headPriestName && (
          <Text style={styles.signature}>住職 {data.temple.headPriestName}</Text>
        )}
      </View>
    </Page>
  );
}

export function DunningLetterPdf({ data }: { data: DunningLetterData }) {
  const issuedDate = formatWarekiSafe(data.issuedAt);
  return (
    <Document>
      {data.recipients.map((r) => (
        <DunningPage
          key={r.householdId}
          recipient={r}
          data={data}
          issuedDate={issuedDate}
        />
      ))}
    </Document>
  );
}
