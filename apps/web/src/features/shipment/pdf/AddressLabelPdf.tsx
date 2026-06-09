import 'server-only';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { PDF_FONT_FAMILY, ensurePdfFontRegistered } from '@/features/nenki/pdf/font';
import {
  A4_HEIGHT_MM,
  A4_WIDTH_MM,
  layoutLabels,
  mmToPt,
  type LabelSheetSpec,
} from '@/lib/shipment';

ensurePdfFontRegistered();

export type AddressLabelItem = {
  householderName: string;
  postalCode: string | null;
  address: string | null;
};

export type AddressLabelData = {
  spec: LabelSheetSpec;
  items: AddressLabelItem[];
};

const styles = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT_FAMILY,
    color: '#111827',
    position: 'relative',
  },
  label: {
    position: 'absolute',
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  postal: {
    fontSize: 9,
    color: '#374151',
    marginBottom: 2,
  },
  address: {
    fontSize: 9,
    marginBottom: 4,
  },
  name: {
    fontSize: 13,
  },
});

export function AddressLabelPdf({ data }: { data: AddressLabelData }) {
  const pages = layoutLabels(data.items, data.spec);

  return (
    <Document>
      {pages.map((page) => (
        <Page
          key={page.pageIndex}
          size={{ width: mmToPt(A4_WIDTH_MM), height: mmToPt(A4_HEIGHT_MM) }}
          style={styles.page}
        >
          {page.labels.map((l, i) => (
            <View
              key={i}
              style={[
                styles.label,
                {
                  left: mmToPt(l.xMm),
                  top: mmToPt(l.yMm),
                  width: mmToPt(l.widthMm),
                  height: mmToPt(l.heightMm),
                },
              ]}
            >
              {l.item.postalCode && (
                <Text style={styles.postal}>〒 {l.item.postalCode}</Text>
              )}
              {l.item.address && (
                <Text style={styles.address}>{l.item.address}</Text>
              )}
              <Text style={styles.name}>{l.item.householderName} 様</Text>
            </View>
          ))}
        </Page>
      ))}
    </Document>
  );
}
