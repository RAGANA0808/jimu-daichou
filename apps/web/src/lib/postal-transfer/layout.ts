/**
 * 郵便振替 払込取扱票 (E35) のレイアウト定数・座標計算 (純関数)。
 *
 * 既製の払込取扱票用紙へオーバープリント (上から重ね印刷) することを想定し、
 * 各記入欄の印字座標を mm 単位の定数で 1 箇所に集約する。実物の正確な寸法は
 * 後日ユーザーから提供されるため、ここは標準的な払込取扱票 (横長 3 連伝票) の
 * 寸法を仮置きする。微調整は POSTAL_SLIP_LAYOUT と各欄座標を書き換えるだけで済む。
 *
 * プリンタ差を吸収するため、印字位置オフセット (mm) を引数で受け取り、
 * 全ての欄を一律に平行移動できるようにする。
 */

/** mm → pt 変換 (PDF は pt 基準。1 inch = 25.4mm = 72pt)。 */
export function mmToPt(mm: number): number {
  return (mm / 25.4) * 72;
}

/**
 * 払込取扱票 1 枚の用紙寸法 (mm)。
 * 郵便振替の払込取扱票は横長の 3 連伝票 (払込票・受領証など) が代表的。
 * 仮値として 幅 188mm × 高さ 93mm を置く (実物に合わせて後日調整)。
 */
export const POSTAL_SLIP_LAYOUT = {
  /** 用紙幅 (mm)。 */
  widthMm: 188,
  /** 用紙高さ (mm)。 */
  heightMm: 93,
} as const;

/** 印字欄の種別。座標定数のキーとして使う。 */
export type PostalSlipFieldKey =
  | 'accountSymbol' // 口座記号
  | 'accountNumber' // 口座番号
  | 'amount' // 金額
  | 'payerName' // ご依頼人 氏名
  | 'payerPostalCode' // ご依頼人 郵便番号
  | 'payerAddress' // ご依頼人 住所
  | 'accountName' // 加入者名
  | 'communication'; // 通信欄

/** 1 つの印字欄のレイアウト (用紙左上を原点とした mm 座標 + フォントサイズ pt)。 */
export type PostalSlipFieldLayout = {
  /** 用紙左端からの X (mm)。 */
  xMm: number;
  /** 用紙上端からの Y (mm)。 */
  yMm: number;
  /** 描画幅 (mm)。折り返し制御に使う。 */
  widthMm: number;
  /** フォントサイズ (pt)。 */
  fontSizePt: number;
};

/**
 * 各印字欄の仮置き座標 (用紙左上原点, mm)。
 * 実物の払込取扱票が手元に来たら、この 1 オブジェクトを書き換えるだけで位置調整できる。
 */
export const POSTAL_SLIP_FIELDS: Record<
  PostalSlipFieldKey,
  PostalSlipFieldLayout
> = {
  accountSymbol: { xMm: 18, yMm: 18, widthMm: 30, fontSizePt: 12 },
  accountNumber: { xMm: 52, yMm: 18, widthMm: 40, fontSizePt: 12 },
  amount: { xMm: 110, yMm: 18, widthMm: 60, fontSizePt: 16 },
  accountName: { xMm: 18, yMm: 34, widthMm: 90, fontSizePt: 11 },
  payerPostalCode: { xMm: 18, yMm: 50, widthMm: 50, fontSizePt: 9 },
  payerAddress: { xMm: 18, yMm: 56, widthMm: 90, fontSizePt: 9 },
  payerName: { xMm: 18, yMm: 70, widthMm: 90, fontSizePt: 12 },
  communication: { xMm: 110, yMm: 40, widthMm: 70, fontSizePt: 8 },
} as const;

/** 印字位置オフセット (mm)。プリンタ差を吸収する全体平行移動。 */
export type PrintOffsetMm = {
  xMm: number;
  yMm: number;
};

export const ZERO_OFFSET: PrintOffsetMm = { xMm: 0, yMm: 0 };

/**
 * 指定欄のレイアウトに印字オフセットを適用した最終座標を返す (純関数)。
 * PDF 側はこの結果をそのまま mmToPt して描画する。
 */
export function placeField(
  key: PostalSlipFieldKey,
  offset: PrintOffsetMm = ZERO_OFFSET,
): PostalSlipFieldLayout {
  const base = POSTAL_SLIP_FIELDS[key];
  return {
    ...base,
    xMm: base.xMm + offset.xMm,
    yMm: base.yMm + offset.yMm,
  };
}

/** オフセット値の安全域 (mm)。常識外の値で用紙外に飛ぶのを防ぐ。 */
export const OFFSET_LIMIT_MM = 30;

/**
 * オフセット値 (mm) を安全域 [-OFFSET_LIMIT_MM, +OFFSET_LIMIT_MM] に丸める (純関数)。
 * NaN は 0 に倒す。
 */
export function clampOffsetMm(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value > OFFSET_LIMIT_MM) return OFFSET_LIMIT_MM;
  if (value < -OFFSET_LIMIT_MM) return -OFFSET_LIMIT_MM;
  return value;
}
