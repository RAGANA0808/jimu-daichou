import 'server-only';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { formatWareki, seirekiToWareki } from '@/lib/wareki';
import { PDF_FONT_FAMILY, ensurePdfFontRegistered } from './font';

// PDF_FONT_FAMILY を使うにはモジュール読込時に register されている必要がある。
ensurePdfFontRegistered();

export type NoticeLetterTarget = {
  householdId: string;
  householderName: string;
  postalCode: string | null;
  address: string | null;
  anniversaries: Array<{
    secularName: string;
    kaimyoName: string | null;
    kaikiName: string; // 例: "三回忌"
    month: number | null;
    day: number | null;
  }>;
};

export type NoticeLetterData = {
  issuedAt: Date;
  temple: {
    name: string;
    headPriestName: string | null;
  };
  targets: NoticeLetterTarget[];
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

function formatScheduleMonthDay(
  month: number | null,
  day: number | null,
): string {
  if (month === null || day === null) return '月日不明';
  return `${month}月${day}日頃`;
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
    marginBottom: 32,
    letterSpacing: 4,
  },
  issuedDate: {
    textAlign: 'right',
    marginBottom: 18,
  },
  recipientBlock: {
    marginBottom: 24,
  },
  postal: {
    fontSize: 10,
    color: '#4B5563',
  },
  address: {
    fontSize: 11,
    marginBottom: 6,
  },
  recipientName: {
    fontSize: 14,
  },
  greeting: {
    marginBottom: 10,
    textIndent: 11, // 一字下げ風
  },
  paragraph: {
    marginBottom: 10,
  },
  anniversariesBlock: {
    marginVertical: 14,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderWidth: 0.5,
    borderColor: '#9CA3AF',
  },
  anniversariesHeading: {
    fontSize: 12,
    marginBottom: 8,
  },
  anniversaryRow: {
    marginBottom: 6,
  },
  anniversaryLabel: {
    color: '#4B5563',
  },
  closingBlock: {
    marginTop: 24,
    alignItems: 'flex-end',
  },
  signature: {
    marginTop: 4,
  },
});

function NoticeLetterPage({
  target,
  temple,
  issuedDate,
}: {
  target: NoticeLetterTarget;
  temple: { name: string; headPriestName: string | null };
  issuedDate: string;
}) {
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.templeName}>{temple.name}</Text>
      <Text style={styles.title}>年忌法要のご案内</Text>

      <Text style={styles.issuedDate}>{issuedDate}</Text>

      <View style={styles.recipientBlock}>
        {target.postalCode && (
          <Text style={styles.postal}>〒 {target.postalCode}</Text>
        )}
        {target.address && (
          <Text style={styles.address}>{target.address}</Text>
        )}
        <Text style={styles.recipientName}>
          {target.householderName} 様
        </Text>
      </View>

      <Text style={styles.greeting}>
        拝啓 時下ますますご清祥のこととお慶び申し上げます。
      </Text>
      <Text style={styles.paragraph}>
        下記ご尊族様の年忌を迎えられるにあたり、ご連絡申し上げます。
        ご法事の日取り等、ご都合をお知らせいただけますと幸いに存じます。
      </Text>

      <View style={styles.anniversariesBlock}>
        <Text style={styles.anniversariesHeading}>ご尊族様</Text>
        {target.anniversaries.map((a, i) => (
          <View key={i} style={styles.anniversaryRow}>
            <Text>
              <Text style={styles.anniversaryLabel}>俗名: </Text>
              {a.secularName}
              {a.kaimyoName && (
                <>
                  <Text style={styles.anniversaryLabel}>  戒名: </Text>
                  {a.kaimyoName}
                </>
              )}
            </Text>
            <Text>
              <Text style={styles.anniversaryLabel}>回忌: </Text>
              {a.kaikiName}
              <Text style={styles.anniversaryLabel}>  予定日: </Text>
              {formatScheduleMonthDay(a.month, a.day)}
            </Text>
          </View>
        ))}
      </View>

      <Text style={styles.paragraph}>
        ご多用のところ恐れ入りますが、ご一考いただけますと幸いです。
      </Text>

      <View style={styles.closingBlock}>
        <Text>敬具</Text>
        <Text style={styles.signature}>{temple.name}</Text>
        {temple.headPriestName && (
          <Text style={styles.signature}>住職 {temple.headPriestName}</Text>
        )}
      </View>
    </Page>
  );
}

export function NoticeLetterPdf({ data }: { data: NoticeLetterData }) {
  const issuedDate = formatIssuedDate(data.issuedAt);
  return (
    <Document>
      {data.targets.map((t) => (
        <NoticeLetterPage
          key={t.householdId}
          target={t}
          temple={data.temple}
          issuedDate={issuedDate}
        />
      ))}
    </Document>
  );
}
