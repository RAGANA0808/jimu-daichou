import type { ShipmentFieldName } from '@/lib/shipment';

export type ShipmentFormState = {
  status: 'idle' | 'error' | 'success';
  errors?: Partial<Record<ShipmentFieldName, string>>;
  values?: Partial<Record<ShipmentFieldName, string>>;
  /** 記録成功時に作成された発送履歴 ID (完了画面への遷移に使う)。 */
  createdBatchId?: string;
  /** 一般エラー (DB 失敗など、フィールド外の事由)。 */
  formError?: string;
};

export const initialShipmentFormState: ShipmentFormState = {
  status: 'idle',
};

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  NOTICE_LETTER: '案内状',
  ADDRESS_LABEL: '宛名ラベル',
  ENVELOPE: '封筒宛名',
  CSV: '宛名 CSV',
};
