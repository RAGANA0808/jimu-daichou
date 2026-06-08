/**
 * インポート対象エンティティのレジストリ。
 *
 * 後続 (過去帳・区画・会計) は entities/ に定義を追加し、ここへ登録するだけで
 * 共通の UI / アクション基盤に乗る。
 */

import type { EntityImportDef, ExistingKeyIndex } from './types';
import { householdImportDef } from './entities/household';
import { deathLedgerImportDef } from './entities/deathLedger';
import { gravePlotImportDef } from './entities/gravePlot';
import { transactionImportDef } from './entities/transaction';

/** 異なる TRecord / TContext を 1 つの配列で扱うための内部表現。 */
type AnyEntityImportDef = EntityImportDef<unknown, ExistingKeyIndex>;

const REGISTRY: AnyEntityImportDef[] = [
  householdImportDef as AnyEntityImportDef,
  deathLedgerImportDef as unknown as AnyEntityImportDef,
  gravePlotImportDef as unknown as AnyEntityImportDef,
  transactionImportDef as unknown as AnyEntityImportDef,
];

export function listImportEntities(): { id: string; label: string; description: string }[] {
  return REGISTRY.map((d) => ({ id: d.id, label: d.label, description: d.description }));
}

export function getImportEntity(id: string): AnyEntityImportDef | null {
  return REGISTRY.find((d) => d.id === id) ?? null;
}
