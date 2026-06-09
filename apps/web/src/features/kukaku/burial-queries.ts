import 'server-only';
import type {
  DateOfDeathPrecision,
  GravePlotStatus,
  GravePlotType,
} from '@prisma/client';
import { requireCurrentTenantId } from '@/lib/auth';
import { assertValidUuid, withTenant } from '@/lib/db';

/** 区画詳細「納骨されている故人」一覧の 1 行。 */
export type BurialWithPerson = {
  id: string;
  interredAt: Date | null;
  removedAt: Date | null;
  memo: string | null;
  person: {
    id: string;
    name: string;
    householdId: string;
    deathLedgerEntry: {
      id: string;
      kaimyoName: string | null;
      secularName: string;
      deathYear: number | null;
      deathMonth: number | null;
      deathDay: number | null;
      datePrecision: DateOfDeathPrecision;
      dateOfDeathWareki: string | null;
    } | null;
  };
};

/** カルテ kukaku タブ「お墓に納骨されている故人」の 1 行。 */
export type HouseholdBurial = {
  id: string;
  interredAt: Date | null;
  removedAt: Date | null;
  person: {
    id: string;
    name: string;
    kaimyoName: string | null;
    secularName: string | null;
  };
  gravePlot: {
    id: string;
    plotNumber: string;
    plotType: GravePlotType;
    status: GravePlotStatus;
    areaId: string | null;
  };
};

/**
 * 指定区画に納骨されている故人一覧 (区画詳細用)。
 * 論理削除 (deletedAt) は除外。現存 (removedAt=null) → 改葬済 の順、納骨日昇順。
 */
export async function listBurialsByPlot(
  gravePlotId: string,
): Promise<BurialWithPerson[]> {
  assertValidUuid(gravePlotId, 'gravePlotId');
  const tenantId = await requireCurrentTenantId();
  const rows = await withTenant(tenantId, (tx) =>
    tx.burial.findMany({
      where: { gravePlotId, deletedAt: null },
      include: {
        person: {
          select: {
            id: true,
            name: true,
            householdId: true,
            deathLedgerEntry: {
              select: {
                id: true,
                kaimyoName: true,
                secularName: true,
                deathYear: true,
                deathMonth: true,
                deathDay: true,
                datePrecision: true,
                dateOfDeathWareki: true,
              },
            },
          },
        },
      },
      orderBy: [{ removedAt: 'asc' }, { interredAt: 'asc' }],
    }),
  );
  return rows.map((r) => ({
    id: r.id,
    interredAt: r.interredAt,
    removedAt: r.removedAt,
    memo: r.memo,
    person: {
      id: r.person.id,
      name: r.person.name,
      householdId: r.person.householdId,
      deathLedgerEntry: r.person.deathLedgerEntry,
    },
  }));
}

/**
 * 指定世帯に属する故人の納骨一覧 (カルテ kukaku タブ用、双方向表示)。
 * 「この世帯の Person が、どの区画に納められているか」を引く。論理削除は除外。
 */
export async function listBurialsByHousehold(
  householdId: string,
): Promise<HouseholdBurial[]> {
  assertValidUuid(householdId, 'householdId');
  const tenantId = await requireCurrentTenantId();
  const rows = await withTenant(tenantId, (tx) =>
    tx.burial.findMany({
      where: { deletedAt: null, person: { householdId } },
      include: {
        gravePlot: {
          select: {
            id: true,
            plotNumber: true,
            plotType: true,
            status: true,
            areaId: true,
          },
        },
        person: {
          select: {
            id: true,
            name: true,
            deathLedgerEntry: {
              select: { kaimyoName: true, secularName: true },
            },
          },
        },
      },
      orderBy: [{ removedAt: 'asc' }, { interredAt: 'asc' }],
    }),
  );
  return rows.map((r) => ({
    id: r.id,
    interredAt: r.interredAt,
    removedAt: r.removedAt,
    person: {
      id: r.person.id,
      name: r.person.name,
      kaimyoName: r.person.deathLedgerEntry?.kaimyoName ?? null,
      secularName: r.person.deathLedgerEntry?.secularName ?? null,
    },
    gravePlot: r.gravePlot,
  }));
}

/** 納骨候補となる Person (区画詳細「納骨を記録」画面用)。 */
export type BurialCandidatePerson = {
  id: string;
  name: string;
  nameKana: string;
  isDeceased: boolean;
  kaimyoName: string | null;
  householderName: string;
  householdId: string;
};

/**
 * 納骨候補の Person を取得する。
 * 区画に契約世帯がある場合はその世帯を優先候補とし、世帯横断のため全 Person も返す。
 * 故人 (isDeceased=true もしくは過去帳あり) を上位に並べる。
 */
export async function listBurialCandidates(options?: {
  preferredHouseholdId?: string | null;
}): Promise<BurialCandidatePerson[]> {
  const tenantId = await requireCurrentTenantId();
  const preferred = options?.preferredHouseholdId ?? null;
  if (preferred !== null) assertValidUuid(preferred, 'householdId');

  const rows = await withTenant(tenantId, (tx) =>
    tx.person.findMany({
      select: {
        id: true,
        name: true,
        nameKana: true,
        isDeceased: true,
        householdId: true,
        household: { select: { householderName: true } },
        deathLedgerEntry: { select: { kaimyoName: true } },
      },
      orderBy: [{ isDeceased: 'desc' }, { nameKana: 'asc' }],
    }),
  );

  return rows
    .map((r) => ({
      id: r.id,
      name: r.name,
      nameKana: r.nameKana,
      isDeceased: r.isDeceased,
      kaimyoName: r.deathLedgerEntry?.kaimyoName ?? null,
      householderName: r.household.householderName,
      householdId: r.householdId,
    }))
    .sort((a, b) => {
      // 区画の契約世帯を最優先で上位に。
      const aPref = preferred !== null && a.householdId === preferred ? 0 : 1;
      const bPref = preferred !== null && b.householdId === preferred ? 0 : 1;
      if (aPref !== bPref) return aPref - bPref;
      return 0;
    });
}
