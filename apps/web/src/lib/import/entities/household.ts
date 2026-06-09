/**
 * 世帯 (Household) + 家族構成員 (Person) のインポート定義。
 *
 * 施主名簿 CSV/Excel を取り込む。最初の対象エンティティであり、後続 (過去帳・区画・会計) の
 * 雛形でもある。
 *
 * 重複判定: lib/search の normalizeKana / normalizePhone を使い、既存世帯との
 * 「かな一致」または「電話一致」を warning として検出する (最小は警告 + スキップ可)。
 */

import type { Prisma } from '@prisma/client';
import { normalizeKana, normalizePhone } from '@/lib/search/normalize';
import { makeKeyIndex } from '../evaluate';
import type {
  ColumnDef,
  EntityImportDef,
  ExistingKeyIndex,
  RowIssue,
} from '../types';

/** インポート 1 行から生成する世帯レコード (確定時に Household + Person を作る)。 */
export type HouseholdImportRecord = {
  householderName: string;
  nameKana: string;
  postalCode: string | null;
  address: string | null;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  secondaryContact: string | null;
  memo: string | null;
  /** 家族構成員 (任意。氏名/ふりがな/続柄をセミコロン区切りで取り込む)。 */
  persons: {
    name: string;
    nameKana: string;
    familyRelation: string | null;
  }[];
};

const COLUMNS: ColumnDef[] = [
  {
    key: 'householderName',
    label: '施主名',
    required: true,
    aliases: ['世帯主', '氏名', '名前', '施主', 'name', 'householder'],
  },
  {
    key: 'nameKana',
    label: 'ふりがな',
    required: true,
    aliases: ['かな', 'カナ', 'フリガナ', 'よみ', '読み', 'kana', 'furigana'],
  },
  {
    key: 'postalCode',
    label: '郵便番号',
    required: false,
    aliases: ['郵便', '〒', 'zip', 'postalcode', 'postal'],
  },
  {
    key: 'address',
    label: '住所',
    required: false,
    aliases: ['所在地', '住居', 'address'],
  },
  {
    key: 'phone',
    label: '電話番号',
    required: false,
    aliases: ['電話', '固定電話', 'tel', 'phone', '自宅電話'],
  },
  {
    key: 'mobile',
    label: '携帯電話',
    required: false,
    aliases: ['携帯', '携帯番号', 'mobile', 'cellphone', 'ケータイ'],
  },
  {
    key: 'email',
    label: 'メールアドレス',
    required: false,
    aliases: ['メール', 'eメール', 'mail', 'email'],
  },
  {
    key: 'secondaryContact',
    label: '第2連絡先',
    required: false,
    aliases: ['予備連絡先', '緊急連絡先', '連絡先2', 'secondarycontact'],
  },
  {
    key: 'memo',
    label: '備考',
    required: false,
    aliases: ['メモ', '備考欄', '特記事項', 'note', 'memo', 'remarks'],
  },
  {
    key: 'familyMembers',
    label: '家族構成員',
    required: false,
    hint: '「氏名:ふりがな:続柄」を1名分とし、複数名は「；」または改行で区切ります。',
    aliases: ['家族', '構成員', '同居家族', 'family', 'members'],
  },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME = 60;

function nullIfBlank(value: string): string | null {
  const t = value.trim();
  return t.length === 0 ? null : t;
}

/** 「氏名:ふりがな:続柄」形式の家族構成員列をパースする。 */
function parseFamilyMembers(raw: string): {
  members: HouseholdImportRecord['persons'];
  issues: RowIssue[];
} {
  const issues: RowIssue[] = [];
  const members: HouseholdImportRecord['persons'] = [];
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { members, issues };

  const entries = trimmed
    .split(/[；;\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const entry of entries) {
    const parts = entry.split(/[:：]/).map((s) => s.trim());
    const name = parts[0] ?? '';
    const kana = parts[1] ?? '';
    const relation = parts[2] ?? '';
    if (name.length === 0) {
      issues.push({
        column: 'familyMembers',
        severity: 'warning',
        message: '家族構成員の氏名が空のため、その1名は取り込みません。',
      });
      continue;
    }
    if (name.length > MAX_NAME || kana.length > MAX_NAME) {
      issues.push({
        column: 'familyMembers',
        severity: 'warning',
        message: `家族構成員「${name}」の氏名/ふりがなが長すぎるため、その1名は取り込みません。`,
      });
      continue;
    }
    members.push({
      name,
      // ふりがな未指定なら世帯側で補えないため空文字を避け、暫定的に氏名を流用する。
      nameKana: kana.length > 0 ? kana : name,
      familyRelation: nullIfBlank(relation),
    });
  }

  return { members, issues };
}

/** 重複判定用の正規化キーを行から導出する (かなキー・電話キー)。 */
function duplicateKeysOf(values: {
  nameKana: string;
  phone: string;
  mobile: string;
}): { kanaKey: string; phoneKeys: string[] } {
  const kanaKey = normalizeKana(values.nameKana);
  const phoneKeys = [normalizePhone(values.phone), normalizePhone(values.mobile)].filter(
    (k) => k.length >= 2,
  );
  return { kanaKey, phoneKeys };
}

export const householdImportDef: EntityImportDef<HouseholdImportRecord> = {
  id: 'household',
  label: '世帯 (檀信徒)',
  description:
    '施主名簿 (CSV / Excel) から世帯と家族構成員を取り込みます。既存世帯と重複する場合は警告を表示し、確定時はスキップします。',
  columns: COLUMNS,

  toRecord(values, ctx) {
    const issues: RowIssue[] = [];

    const householderName = values.householderName?.trim() ?? '';
    const nameKana = values.nameKana?.trim() ?? '';

    if (householderName.length === 0) {
      issues.push({ column: 'householderName', severity: 'error', message: '施主名が未入力です。' });
    } else if (householderName.length > MAX_NAME) {
      issues.push({
        column: 'householderName',
        severity: 'error',
        message: '施主名が60文字を超えています。',
      });
    }

    if (nameKana.length === 0) {
      issues.push({ column: 'nameKana', severity: 'error', message: 'ふりがなが未入力です。' });
    } else if (nameKana.length > MAX_NAME) {
      issues.push({ column: 'nameKana', severity: 'error', message: 'ふりがなが60文字を超えています。' });
    }

    const email = values.email?.trim() ?? '';
    if (email.length > 0 && !EMAIL_RE.test(email)) {
      issues.push({
        column: 'email',
        severity: 'warning',
        message: 'メールアドレスの形式が正しくない可能性があります。',
      });
    }

    const { members, issues: memberIssues } = parseFamilyMembers(values.familyMembers ?? '');
    issues.push(...memberIssues);

    // 既存データとの重複検出 (かな or 電話)。
    const { kanaKey, phoneKeys } = duplicateKeysOf({
      nameKana,
      phone: values.phone ?? '',
      mobile: values.mobile ?? '',
    });
    const dupByKana = kanaKey.length > 0 && ctx.existing.has(`kana:${kanaKey}`);
    const dupByPhone = phoneKeys.some((k) => ctx.existing.has(`phone:${k}`));
    if (dupByKana || dupByPhone) {
      const reason = dupByPhone ? '電話番号' : 'ふりがな';
      issues.push({
        column: null,
        severity: 'warning',
        message: `既存の世帯と${reason}が一致します。確定時はスキップされます (取り込みません)。`,
      });
    }

    const hasError = issues.some((i) => i.severity === 'error');
    // 重複 warning の行は確定時に登録しない (スキップ)。
    const isDuplicate = dupByKana || dupByPhone;
    if (hasError || isDuplicate) {
      return { issues, record: null };
    }

    const record: HouseholdImportRecord = {
      householderName,
      nameKana,
      postalCode: nullIfBlank(values.postalCode ?? ''),
      address: nullIfBlank(values.address ?? ''),
      phone: nullIfBlank(values.phone ?? ''),
      mobile: nullIfBlank(values.mobile ?? ''),
      email: nullIfBlank(email),
      secondaryContact: nullIfBlank(values.secondaryContact ?? ''),
      memo: nullIfBlank(values.memo ?? ''),
      persons: members,
    };
    return { issues, record };
  },

  async loadExistingKeys(tx, _tenantId): Promise<ExistingKeyIndex> {
    // RLS により withTenant 配下では自テナントの世帯のみ見える。
    const households = await tx.household.findMany({
      where: { isActive: true },
      select: { nameKana: true, phone: true, mobile: true },
    });
    const keys: string[] = [];
    for (const h of households) {
      const kana = normalizeKana(h.nameKana);
      if (kana.length > 0) keys.push(`kana:${kana}`);
      for (const p of [h.phone, h.mobile]) {
        if (!p) continue;
        const np = normalizePhone(p);
        if (np.length >= 2) keys.push(`phone:${np}`);
      }
    }
    return makeKeyIndex(keys);
  },

  async insertBatch(tx, tenantId, records): Promise<number> {
    let inserted = 0;
    for (const rec of records) {
      const household = await tx.household.create({
        data: {
          tenantId,
          householderName: rec.householderName,
          nameKana: rec.nameKana,
          postalCode: rec.postalCode,
          address: rec.address,
          phone: rec.phone,
          mobile: rec.mobile,
          email: rec.email,
          secondaryContact: rec.secondaryContact,
          memo: rec.memo,
        },
        select: { id: true },
      });
      if (rec.persons.length > 0) {
        const personData: Prisma.PersonCreateManyInput[] = rec.persons.map((p) => ({
          tenantId,
          householdId: household.id,
          name: p.name,
          nameKana: p.nameKana,
          familyRelation: p.familyRelation,
          isDeceased: false,
        }));
        await tx.person.createMany({ data: personData });
      }
      inserted += 1;
    }
    return inserted;
  },
};
