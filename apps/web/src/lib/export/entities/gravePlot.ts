/**
 * 区画 (GravePlot) のエクスポート定義。
 *
 * 列はインポート (lib/import/entities/gravePlot) と同じキー・ラベルを使う。
 * 区画種別・状態は日本語ラベルへ戻し (再インポート互換)、エリア名・契約世帯名も添える。
 */

import {
  blankIfNull,
  formatDateCell,
  formatGravePlotStatus,
  formatGravePlotType,
} from '../format';
import type { EntityExportDef, ExportColumn } from '../types';

const COLUMNS: ExportColumn[] = [
  { key: 'plotNumber', label: '区画番号' },
  { key: 'plotType', label: '区画種別' },
  { key: 'status', label: '状態' },
  { key: 'contractDate', label: '契約日' },
  { key: 'contractPlan', label: '契約プラン' },
  { key: 'areaName', label: 'エリア名' },
  { key: 'householderName', label: '契約世帯 (施主名)' },
  { key: 'memo', label: '備考' },
];

export const gravePlotExportDef: EntityExportDef = {
  id: 'grave-plot',
  label: '区画 (お墓)',
  description: '墓地区画を CSV / Excel で書き出します。エリア名・契約世帯名も添えます。',
  fileBaseName: 'grave-plots',
  sheetName: '区画',
  columns: COLUMNS,
  filterKind: 'none',

  async fetchRows(tx, _tenantId, _filter) {
    // RLS 配下。area + household を include して N+1 を避ける。
    const plots = await tx.gravePlot.findMany({
      include: {
        area: { select: { name: true } },
        household: { select: { householderName: true } },
      },
      orderBy: { plotNumber: 'asc' },
    });

    return plots.map((p) => ({
      plotNumber: p.plotNumber,
      plotType: formatGravePlotType(p.plotType),
      status: formatGravePlotStatus(p.status),
      contractDate: formatDateCell(p.contractDate),
      contractPlan: blankIfNull(p.contractPlan),
      areaName: blankIfNull(p.area?.name ?? null),
      householderName: blankIfNull(p.household?.householderName ?? null),
      memo: blankIfNull(p.memo),
    }));
  },
};
