/**
 * 過去帳 (DeathLedgerEntry) + 故人 (Person) のインポート定義。
 *
 * 既存の過去帳/位牌台帳 CSV/Excel を取り込む。1 行 = 故人 1 名。
 *
 * 世帯への紐付け方針:
 * - 行の「施主名」または「ふりがな」が既存世帯と正規化一致すれば、その世帯へ紐づける。
 * - 一致する世帯が無い場合は、その故人の世帯として新規に世帯を作成して紐づける
 *   (Person.householdId は NOT NULL のため未割当のまま保存できない。データを失わないよう
 *    新規世帯を起こすことで「未割当」を避ける)。施主名・ふりがなが両方とも空の行はエラー。
 *
 * 没年月日は明治以前・年のみ・月日不明・和暦表記に対応する
 * (lib/kakochou/parseDeathDateCell)。
 *
 * 重複判定: 既存世帯 + 同名 (俗名の正規化一致) の故人が過去帳に存在する場合に warning とし、
 * 確定時はスキップする (過去帳は物理削除しないため、二重登録を未然に防ぐ)。
 */

import {
  parseDeathDateCell,
  normalizeSecularName,
  type NormalizedDeathDate,
} from '@/lib/kakochou';
import { normalizeKana } from '@/lib/search/normalize';
import { formatWareki, seirekiToWareki } from '@/lib/wareki';
import type {
  ColumnDef,
  EntityImportDef,
  ExistingKeyIndex,
  RowIssue,
} from '../types';

/** 確定時に Person + DeathLedgerEntry を作る 1 行分のレコード。 */
export type DeathLedgerImportRecord = {
  secularName: string;
  nameKana: string;
  kaimyoName: string | null;
  deathDate: NormalizedDeathDate;
  ageAtDeath: number | null;
  burialLocation: string | null;
  familyRelation: string | null;
  memo: string | null;
  /** 紐付け先世帯の解決方法。 */
  household:
    | { kind: 'existing'; householdId: string }
    | { kind: 'new'; householderName: string; nameKana: string };
};

/**
 * 過去帳インポート用の照合コンテキスト。
 * ExistingKeyIndex (重複キー集合) を満たしつつ、施主名/かな → 世帯 id の名寄せ表を併せ持つ。
 */
export type DeathLedgerExistingIndex = ExistingKeyIndex & {
  /** 正規化済みの施主名 or かなキー → 世帯 id。未一致は null。 */
  householdIdByMatchKey(key: string): string | null;
};

const COLUMNS: ColumnDef[] = [
  {
    key: 'secularName',
    label: '俗名',
    required: true,
    hint: '故人の生前の氏名です。',
    aliases: ['氏名', '名前', '故人名', '俗名', 'secularname', 'name'],
  },
  {
    key: 'nameKana',
    label: 'ふりがな',
    required: false,
    hint: '未入力の場合は俗名を仮のふりがなとして用います。',
    aliases: ['かな', 'カナ', 'フリガナ', 'よみ', '読み', 'kana', 'furigana'],
  },
  {
    key: 'kaimyoName',
    label: '戒名',
    required: false,
    aliases: ['法名', '戒名・法名', 'kaimyo', 'kaimyoname', 'posthumousname'],
  },
  {
    key: 'dateOfDeath',
    label: '没年月日',
    required: false,
    hint: '西暦・和暦どちらも可。年のみ・年月のみ・不明も取り込めます (例: 令和6年3月15日 / 2024-03-15 / 明治12年)。',
    aliases: ['没日', '命日', '死亡日', '逝去日', '没年', 'dateofdeath', 'deathdate'],
  },
  {
    key: 'ageAtDeath',
    label: '行年',
    required: false,
    hint: '0〜150 の整数。',
    aliases: ['享年', '年齢', '没年齢', 'age', 'ageatdeath'],
  },
  {
    key: 'burialLocation',
    label: '埋葬場所',
    required: false,
    aliases: ['納骨場所', '墓所', '埋葬地', 'burial', 'buriallocation'],
  },
  {
    key: 'familyRelation',
    label: '続柄',
    required: false,
    hint: '世帯主から見た続柄 (父・母・配偶者・長男 等)。',
    aliases: ['関係', '間柄', 'relation', 'familyrelation'],
  },
  {
    key: 'householderName',
    label: '施主名',
    required: false,
    hint: '紐付け先の世帯 (施主) 名。既存世帯と一致すればその世帯へ、無ければ世帯を新規作成します。',
    aliases: ['世帯主', '世帯', '施主', 'householder', 'householdername'],
  },
  {
    key: 'householderKana',
    label: '施主ふりがな',
    required: false,
    hint: '施主名のふりがな。世帯の照合・新規作成に用います。',
    aliases: ['世帯かな', '施主かな', '世帯主かな', 'householderkana'],
  },
  {
    key: 'memo',
    label: '備考',
    required: false,
    aliases: ['メモ', '備考欄', '特記事項', 'note', 'memo', 'remarks'],
  },
];

const MAX_NAME = 60;
const MAX_KAIMYO = 120;

function nullIfBlank(value: string): string | null {
  const t = value.trim();
  return t.length === 0 ? null : t;
}

const DEATH_DATE_MESSAGE: Record<string, string> = {
  year_required_for_month: '没月のみで没年が無いため、没年月日を取り込めません。',
  month_required_for_day: '没日のみで没月が無いため、没年月日を取り込めません。',
  year_out_of_range: '没年が範囲外です。',
  month_out_of_range: '没月は 1〜12 でご入力ください。',
  day_out_of_range: '没日は 1〜31 でご入力ください。',
  invalid_calendar_date: '実在しない没年月日です。',
  unrecognized_format: '没年月日の形式を読み取れませんでした。',
  wareki_out_of_range: '和暦の没年月日を読み取れませんでした。',
};

/** FULL のときだけ和暦表記を組み立てる。組み立てられなければ null。 */
function computeWareki(d: NormalizedDeathDate): string | null {
  if (d.precision !== 'FULL' || d.year === null || d.month === null || d.day === null) {
    return null;
  }
  try {
    return formatWareki(seirekiToWareki({ year: d.year, month: d.month, day: d.day }));
  } catch {
    return null;
  }
}

function parseAge(raw: string): number | null | false {
  const t = raw.trim();
  if (t.length === 0) return null;
  const n = Number.parseInt(t, 10);
  if (Number.isNaN(n) || String(n) !== t || n < 0 || n > 150) return false;
  return n;
}

export const deathLedgerImportDef: EntityImportDef<
  DeathLedgerImportRecord,
  DeathLedgerExistingIndex
> = {
  id: 'death-ledger',
  label: '過去帳 (故人)',
  description:
    '過去帳・位牌台帳 (CSV / Excel) から故人を取り込みます。没年月日は西暦・和暦のどちらにも対応し、年のみ・月日不明も取り込めます。施主名で世帯へ紐づけ、一致する世帯が無ければ世帯を新規作成します。既存の同名故人がいる場合は警告し、確定時はスキップします。',
  columns: COLUMNS,

  toRecord(values, ctx) {
    const issues: RowIssue[] = [];

    const secularName = (values.secularName ?? '').trim();
    if (secularName.length === 0) {
      issues.push({ column: 'secularName', severity: 'error', message: '俗名が未入力です。' });
    } else if (secularName.length > MAX_NAME) {
      issues.push({ column: 'secularName', severity: 'error', message: '俗名が60文字を超えています。' });
    }

    const nameKanaRaw = (values.nameKana ?? '').trim();
    if (nameKanaRaw.length > MAX_NAME) {
      issues.push({ column: 'nameKana', severity: 'error', message: 'ふりがなが60文字を超えています。' });
    }
    const nameKana = nameKanaRaw.length > 0 ? nameKanaRaw : secularName;

    const kaimyo = (values.kaimyoName ?? '').trim();
    if (kaimyo.length > MAX_KAIMYO) {
      issues.push({ column: 'kaimyoName', severity: 'error', message: '戒名が120文字を超えています。' });
    }

    let deathDate: NormalizedDeathDate | null = null;
    const parsedDate = parseDeathDateCell(values.dateOfDeath ?? '');
    if (!parsedDate.ok) {
      issues.push({
        column: 'dateOfDeath',
        severity: 'error',
        message: DEATH_DATE_MESSAGE[parsedDate.error] ?? '没年月日を読み取れませんでした。',
      });
    } else {
      deathDate = parsedDate.value;
    }

    let ageAtDeath: number | null = null;
    const age = parseAge(values.ageAtDeath ?? '');
    if (age === false) {
      issues.push({ column: 'ageAtDeath', severity: 'error', message: '行年は 0〜150 の整数でご入力ください。' });
    } else {
      ageAtDeath = age;
    }

    // 世帯の解決: 施主名 or 施主ふりがな の正規化一致で既存世帯を探す。
    const householderName = (values.householderName ?? '').trim();
    const householderKana = (values.householderKana ?? '').trim();
    let household: DeathLedgerImportRecord['household'] | null = null;

    const nameKey = householderName.length > 0 ? `name:${normalizeSecularName(householderName)}` : '';
    const kanaKey = householderKana.length > 0 ? `kana:${normalizeKana(householderKana)}` : '';
    const matchedId =
      (nameKey.length > 0 ? ctx.existing.householdIdByMatchKey(nameKey) : null) ??
      (kanaKey.length > 0 ? ctx.existing.householdIdByMatchKey(kanaKey) : null);

    if (matchedId !== null) {
      household = { kind: 'existing', householdId: matchedId };
    } else if (householderName.length > 0) {
      household = {
        kind: 'new',
        householderName,
        nameKana: householderKana.length > 0 ? householderKana : householderName,
      };
    } else {
      issues.push({
        column: 'householderName',
        severity: 'error',
        message: '施主名が無いため世帯を特定できません。施主名の列を割り当ててください。',
      });
    }

    // 既存世帯 + 同名故人の重複検出 (warning → 確定時スキップ)。
    let isDuplicate = false;
    if (household?.kind === 'existing' && secularName.length > 0) {
      const dupKey = `dup:${household.householdId}:${normalizeSecularName(secularName)}`;
      if (ctx.existing.has(dupKey)) {
        isDuplicate = true;
        issues.push({
          column: null,
          severity: 'warning',
          message: '同じ世帯に同名の故人が既に過去帳へ登録されています。確定時はスキップします。',
        });
      }
    }

    const hasError = issues.some((i) => i.severity === 'error');
    if (hasError || isDuplicate || deathDate === null || household === null) {
      return { issues, record: null };
    }

    const record: DeathLedgerImportRecord = {
      secularName,
      nameKana,
      kaimyoName: nullIfBlank(kaimyo),
      deathDate,
      ageAtDeath,
      burialLocation: nullIfBlank(values.burialLocation ?? ''),
      familyRelation: nullIfBlank(values.familyRelation ?? ''),
      memo: nullIfBlank(values.memo ?? ''),
      household,
    };
    return { issues, record };
  },

  async loadExistingKeys(tx, _tenantId): Promise<DeathLedgerExistingIndex> {
    // RLS により withTenant 配下では自テナントのみ見える。
    const households = await tx.household.findMany({
      where: { isActive: true },
      select: { id: true, householderName: true, nameKana: true },
    });
    const householdMap = new Map<string, string>();
    for (const h of households) {
      const nk = normalizeSecularName(h.householderName);
      if (nk.length > 0 && !householdMap.has(`name:${nk}`)) householdMap.set(`name:${nk}`, h.id);
      const kk = normalizeKana(h.nameKana);
      if (kk.length > 0 && !householdMap.has(`kana:${kk}`)) householdMap.set(`kana:${kk}`, h.id);
    }

    // 既存の (除外されていない) 過去帳エントリで「世帯 id + 俗名」の重複キー集合を作る。
    const entries = await tx.deathLedgerEntry.findMany({
      where: { deletedAt: null },
      select: { secularName: true, person: { select: { householdId: true } } },
    });
    const dupSet = new Set<string>();
    for (const e of entries) {
      const key = `dup:${e.person.householdId}:${normalizeSecularName(e.secularName)}`;
      dupSet.add(key);
    }

    return {
      has: (key) => dupSet.has(key),
      householdIdByMatchKey: (key) => householdMap.get(key) ?? null,
    };
  },

  async insertBatch(tx, tenantId, records): Promise<number> {
    let inserted = 0;
    // 同一ファイル内で同じ「新規世帯」が複数行に現れた場合、世帯を 1 つに集約する。
    const newHouseholdCache = new Map<string, string>();

    for (const rec of records) {
      let householdId: string;
      if (rec.household.kind === 'existing') {
        householdId = rec.household.householdId;
      } else {
        const cacheKey = `${normalizeSecularName(rec.household.householderName)}|${normalizeKana(rec.household.nameKana)}`;
        const cached = newHouseholdCache.get(cacheKey);
        if (cached) {
          householdId = cached;
        } else {
          const created = await tx.household.create({
            data: {
              tenantId,
              householderName: rec.household.householderName,
              nameKana: rec.household.nameKana,
            },
            select: { id: true },
          });
          householdId = created.id;
          newHouseholdCache.set(cacheKey, householdId);
        }
      }

      const person = await tx.person.create({
        data: {
          tenantId,
          householdId,
          name: rec.secularName,
          nameKana: rec.nameKana,
          familyRelation: rec.familyRelation,
          isDeceased: true,
        },
        select: { id: true },
      });

      await tx.deathLedgerEntry.create({
        data: {
          tenantId,
          personId: person.id,
          secularName: rec.secularName,
          kaimyoName: rec.kaimyoName,
          dateOfDeath: rec.deathDate.date,
          deathYear: rec.deathDate.year,
          deathMonth: rec.deathDate.month,
          deathDay: rec.deathDate.day,
          datePrecision: rec.deathDate.precision,
          dateOfDeathWareki: computeWareki(rec.deathDate),
          ageAtDeath: rec.ageAtDeath,
          burialLocation: rec.burialLocation,
          memo: rec.memo,
        },
      });
      inserted += 1;
    }
    return inserted;
  },
};
