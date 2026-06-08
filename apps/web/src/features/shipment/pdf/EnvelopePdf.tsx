import 'server-only';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { PDF_FONT_FAMILY, ensurePdfFontRegistered } from '@/features/nenki/pdf/font';
import { mmToPt } from '@/lib/shipment';

ensurePdfFontRegistered();

// 長形 3 号封筒 (120mm × 235mm) を横置きで使う想定 (差出人を左下、宛名を中央)。
const ENVELOPE_WIDTH_MM = 235;
const ENVELOPE_HEIGHT_MM = 120;

export type EnvelopeItem = {
  householderName: string;
  postalCode: string | null;
  address: string | null;
};

export type EnvelopeSender = {
  templeName: string;
  postalCode: string | null;
  address: string | null;
};

export type EnvelopeData = {
  sender: EnvelopeSender;
  items: EnvelopeItem[];
};

const styles = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT_FAMILY,
    color: '#111827',
    padding: 28,
    position: 'relative',
  },
  recipientBlock: {
    marginTop: 24,
    marginLeft: 40,
  },
  recipientPostal: {
    fontSize: 11,
    color: '#374151',
    marginBottom: 4,
  },
  recipientAddress: {
    fontSize: 13,
    marginBottom: 10,
  },
  recipientName: {
    fontSize: 22,
    letterSpacing: 2,
  },
  senderBlock: {
    position: 'absolute',
    left: 28,
    bottom: 24,
  },
  senderPostal: {
    fontSize: 9,
    color: '#4B5563',
  },
  senderAddress: {
    fontSize: 9,
    color: '#4B5563',
  },
  senderName: {
    fontSize: 11,
    marginTop: 2,
  },
});

export function EnvelopePdf({ data }: { data: EnvelopeData }) {
  return (
    <Document>
      {data.items.map((item, i) => (
        <Page
          key={i}
          size={{
            width: mmToPt(ENVELOPE_WIDTH_MM),
            height: mmToPt(ENVELOPE_HEIGHT_MM),
          }}
          style={styles.page}
        >
          <View style={styles.recipientBlock}>
            {item.postalCode && (
              <Text style={styles.recipientPostal}>〒 {item.postalCode}</Text>
            )}
            {item.address && (
              <Text style={styles.recipientAddress}>{item.address}</Text>
            )}
            <Text style={styles.recipientName}>{item.householderName} 様</Text>
          </View>

          <View style={styles.senderBlock}>
            {data.sender.postalCode && (
              <Text style={styles.senderPostal}>〒 {data.sender.postalCode}</Text>
            )}
            {data.sender.address && (
              <Text style={styles.senderAddress}>{data.sender.address}</Text>
            )}
            <Text style={styles.senderName}>{data.sender.templeName}</Text>
          </View>
        </Page>
      ))}
    </Document>
  );
}
