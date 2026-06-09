import 'server-only';
import { Fragment } from 'react';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import {
  PDF_FONT_FAMILY,
  ensurePdfFontRegistered,
} from '@/features/nenki/pdf/font';
import {
  formatAmountDigits,
  mmToPt,
  placeField,
  POSTAL_SLIP_LAYOUT,
  type PostalSlip,
  type PostalSlipFieldKey,
  type PrintOffsetMm,
} from '@/lib/postal-transfer';

ensurePdfFontRegistered();

export type PostalTransferAccountInfo = {
  /** 加入者名 (口座名義)。空なら寺名にフォールバック。 */
  accountName: string | null;
  accountSymbol: string | null;
  accountNumber: string | null;
  /** 通信欄の既定文 (任意)。 */
  note: string | null;
};

export type PostalTransferPdfData = {
  account: PostalTransferAccountInfo;
  offset: PrintOffsetMm;
  /** 既製用紙へのオーバープリント時は枠線・ガイドを描かない。プレビュー時は描く。 */
  showGuide: boolean;
  slips: PostalSlip[];
};

const styles = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT_FAMILY,
    color: '#111827',
    position: 'relative',
  },
  field: {
    position: 'absolute',
  },
  fieldText: {
    color: '#111827',
  },
  amountText: {
    color: '#111827',
  },
  guideBorder: {
    position: 'absolute',
    borderWidth: 0.5,
    borderColor: '#D1D5DB',
  },
  guideLabel: {
    position: 'absolute',
    fontSize: 5,
    color: '#9CA3AF',
  },
  detailSheet: {
    fontFamily: PDF_FONT_FAMILY,
    paddingTop: 36,
    paddingHorizontal: 48,
    paddingBottom: 36,
    color: '#111827',
    fontSize: 11,
    lineHeight: 1.6,
  },
});

/** 1 つの印字欄。オーバープリント前提なので余白なしの絶対配置。 */
function Field({
  fieldKey,
  offset,
  value,
  showGuide,
  guideLabel,
}: {
  fieldKey: PostalSlipFieldKey;
  offset: PrintOffsetMm;
  value: string;
  showGuide: boolean;
  guideLabel?: string;
}) {
  const layout = placeField(fieldKey, offset);
  return (
    <>
      {showGuide && (
        <>
          <View
            style={[
              styles.guideBorder,
              {
                left: mmToPt(layout.xMm - 1),
                top: mmToPt(layout.yMm - 1),
                width: mmToPt(layout.widthMm + 2),
                height: mmToPt(layout.fontSizePt / 2.5 + 3),
              },
            ]}
          />
          {guideLabel && (
            <Text
              style={[
                styles.guideLabel,
                { left: mmToPt(layout.xMm - 1), top: mmToPt(layout.yMm - 3) },
              ]}
            >
              {guideLabel}
            </Text>
          )}
        </>
      )}
      <View
        style={[
          styles.field,
          {
            left: mmToPt(layout.xMm),
            top: mmToPt(layout.yMm),
            width: mmToPt(layout.widthMm),
          },
        ]}
      >
        <Text style={[styles.fieldText, { fontSize: layout.fontSizePt }]}>
          {value}
        </Text>
      </View>
    </>
  );
}

function SlipPage({
  slip,
  account,
  offset,
  showGuide,
}: {
  slip: PostalSlip;
  account: PostalTransferAccountInfo;
  offset: PrintOffsetMm;
  showGuide: boolean;
}) {
  const accountName = account.accountName ?? '';
  // 通信欄: 科目内訳 + 既定文。檀家が何にいくら払うか分かるように科目別を併記する。
  const breakdown = slip.lines
    .map((l) => `${l.name} ${formatAmountDigits(l.amount)}円`)
    .join(' / ');
  const communication = [breakdown, account.note]
    .filter((s) => s && s.length > 0)
    .join('\n');

  return (
    <Page
      size={{
        width: mmToPt(POSTAL_SLIP_LAYOUT.widthMm),
        height: mmToPt(POSTAL_SLIP_LAYOUT.heightMm),
      }}
      style={styles.page}
    >
      {showGuide && (
        <View
          style={[
            styles.guideBorder,
            {
              left: 0,
              top: 0,
              width: mmToPt(POSTAL_SLIP_LAYOUT.widthMm),
              height: mmToPt(POSTAL_SLIP_LAYOUT.heightMm),
              borderColor: '#9CA3AF',
            },
          ]}
        />
      )}

      {account.accountSymbol && (
        <Field
          fieldKey="accountSymbol"
          offset={offset}
          value={account.accountSymbol}
          showGuide={showGuide}
          guideLabel="口座記号"
        />
      )}
      {account.accountNumber && (
        <Field
          fieldKey="accountNumber"
          offset={offset}
          value={account.accountNumber}
          showGuide={showGuide}
          guideLabel="口座番号"
        />
      )}
      <Field
        fieldKey="amount"
        offset={offset}
        value={`￥${formatAmountDigits(slip.total)}`}
        showGuide={showGuide}
        guideLabel="金額"
      />
      {accountName.length > 0 && (
        <Field
          fieldKey="accountName"
          offset={offset}
          value={accountName}
          showGuide={showGuide}
          guideLabel="加入者名"
        />
      )}
      {slip.postalCode && (
        <Field
          fieldKey="payerPostalCode"
          offset={offset}
          value={`〒${slip.postalCode}`}
          showGuide={showGuide}
          guideLabel="ご依頼人 郵便番号"
        />
      )}
      {slip.address && (
        <Field
          fieldKey="payerAddress"
          offset={offset}
          value={slip.address}
          showGuide={showGuide}
          guideLabel="ご依頼人 住所"
        />
      )}
      <Field
        fieldKey="payerName"
        offset={offset}
        value={`${slip.householderName} 様`}
        showGuide={showGuide}
        guideLabel="ご依頼人 氏名"
      />
      {communication.length > 0 && (
        <Field
          fieldKey="communication"
          offset={offset}
          value={communication}
          showGuide={showGuide}
          guideLabel="通信欄"
        />
      )}
    </Page>
  );
}

/** 別紙明細 (科目・金額の内訳)。檀家向けに「何にいくら」を A4 で添付できる。 */
function DetailPage({
  slip,
  account,
}: {
  slip: PostalSlip;
  account: PostalTransferAccountInfo;
}) {
  return (
    <Page size="A4" style={styles.detailSheet}>
      <Text style={{ fontSize: 16, marginBottom: 4, textAlign: 'center' }}>
        払込内容のご明細
      </Text>
      <Text style={{ marginBottom: 16, textAlign: 'center', color: '#4B5563' }}>
        {account.accountName ?? ''}
      </Text>

      <View style={{ marginBottom: 12 }}>
        <Text>{slip.householderName} 様</Text>
        {slip.address && (
          <Text style={{ fontSize: 10, color: '#4B5563' }}>
            {slip.postalCode ? `〒${slip.postalCode} ` : ''}
            {slip.address}
          </Text>
        )}
      </View>

      <View
        style={{
          borderTopWidth: 0.5,
          borderColor: '#9CA3AF',
          marginBottom: 4,
        }}
      />
      {slip.lines.map((l) => (
        <View
          key={l.subjectId}
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingVertical: 4,
            borderBottomWidth: 0.5,
            borderColor: '#E5E7EB',
          }}
        >
          <Text>{l.name}</Text>
          <Text>{formatAmountDigits(l.amount)} 円</Text>
        </View>
      ))}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingVertical: 8,
        }}
      >
        <Text style={{ fontSize: 13 }}>合計</Text>
        <Text style={{ fontSize: 13 }}>
          {formatAmountDigits(slip.total)} 円
        </Text>
      </View>

      {account.note && (
        <Text style={{ marginTop: 16, fontSize: 10, color: '#4B5563' }}>
          {account.note}
        </Text>
      )}
    </Page>
  );
}

export function PostalTransferPdf({ data }: { data: PostalTransferPdfData }) {
  return (
    <Document>
      {data.slips.map((slip) => (
        <SlipPage
          key={slip.householdId}
          slip={slip}
          account={data.account}
          offset={data.offset}
          showGuide={data.showGuide}
        />
      ))}
    </Document>
  );
}

/** 払込票 + 別紙明細を交互に出す版 (檀家配布用)。 */
export function PostalTransferWithDetailPdf({
  data,
}: {
  data: PostalTransferPdfData;
}) {
  return (
    <Document>
      {data.slips.map((slip) => (
        <Fragment key={slip.householdId}>
          <SlipPage
            slip={slip}
            account={data.account}
            offset={data.offset}
            showGuide={data.showGuide}
          />
          <DetailPage slip={slip} account={data.account} />
        </Fragment>
      ))}
    </Document>
  );
}
