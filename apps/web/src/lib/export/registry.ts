/**
 * エクスポート対象エンティティのレジストリ。
 * インポート (lib/import/registry) と対になり、同じ id / label を使う。
 */

import type { EntityExportDef } from './types';
import { householdExportDef } from './entities/household';
import { deathLedgerExportDef } from './entities/deathLedger';
import { gravePlotExportDef } from './entities/gravePlot';
import { transactionExportDef } from './entities/transaction';

const REGISTRY: EntityExportDef[] = [
  householdExportDef,
  deathLedgerExportDef,
  gravePlotExportDef,
  transactionExportDef,
];

export function listExportEntities(): {
  id: string;
  label: string;
  description: string;
  filterKind: EntityExportDef['filterKind'];
}[] {
  return REGISTRY.map((d) => ({
    id: d.id,
    label: d.label,
    description: d.description,
    filterKind: d.filterKind,
  }));
}

export function getExportEntity(id: string): EntityExportDef | null {
  return REGISTRY.find((d) => d.id === id) ?? null;
}
