import 'server-only';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { formatWareki, seirekiToWareki } from '@/lib/wareki';
import { PDF_FONT_FAMILY, ensurePdfFontRegistered } from '@/features/nenki/pdf/font';

ensurePdfFontRegistered();

export type MergedNoticeRecipient = {
  householdId: string;
  householderName: string;
  postalCode: string | null;
  address: string | null;
  /** 差込概要 (例: "山田花子 三回忌")。 */
  summary: string;
};

export type MergedNoticeData = {
  issuedAt: Date;
  temple: { name: string; headPriestName: string | null };
  /** 差込項目 (フォーム入力)。 */
  serviceDate: Date | null;
  location: string | null;
  offeringGuide: string | null;
  replyDeadline: Date | null;
  bodyNote: string | null;
  recipients: MergedNoticeRecipient[];
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

function formatDateTime(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${formatWarekiSafe(d)} ${hh}時${mm}分`;
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
  detailLabel: { width: 78, color: '#4B5563' },
  detailValue: { flex: 1 },
  closingBlock: { marginTop: 24, alignItems: 'flex-end' },
  signature: { marginTop: 4 },
});

function NoticePage({
  recipient,
  data,
  issuedDate,
}: {
  recipient: MergedNoticeRecipient;
  data: MergedNoticeData;
  issuedDate: string;
}) {
  const hasDetail =
    data.serviceDate ||
    data.location ||
    data.offeringGuide ||
    data.replyDeadline;

  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.templeName}>{data.temple.name}</Text>
      <Text style={styles.title}>年忌法要のご案内</Text>
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
        拝啓 時下ますますご清祥のこととお慶び申し上げます。
      </Text>
      <Text style={styles.paragraph}>
        このたび、{recipient.summary} の年忌法要を相営みたく、下記のとおりご案内申し上げます。
      </Text>

      {hasDetail && (
        <View style={styles.detailBox}>
          {data.serviceDate && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>日時</Text>
              <Text style={styles.detailValue}>
                {formatDateTime(data.serviceDate)}
              </Text>
            </View>
          )}
          {data.location && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>場所</Text>
              <Text style={styles.detailValue}>{data.location}</Text>
            </View>
          )}
          {data.offeringGuide && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>お布施の目安</Text>
              <Text style={styles.detailValue}>{data.offeringGuide}</Text>
            </View>
          )}
          {data.replyDeadline && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>返信締切</Text>
              <Text style={styles.detailValue}>
                {formatWarekiSafe(data.replyDeadline)} まで
              </Text>
            </View>
          )}
        </View>
      )}

      {data.bodyNote && <Text style={styles.paragraph}>{data.bodyNote}</Text>}

      <Text style={styles.paragraph}>
        ご多用のところ恐れ入りますが、ご都合をお知らせいただけますと幸いに存じます。
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

export function MergedNoticeLetterPdf({ data }: { data: MergedNoticeData }) {
  const issuedDate = formatWarekiSafe(data.issuedAt);
  return (
    <Document>
      {data.recipients.map((r) => (
        <NoticePage
          key={r.householdId}
          recipient={r}
          data={data}
          issuedDate={issuedDate}
        />
      ))}
    </Document>
  );
}
