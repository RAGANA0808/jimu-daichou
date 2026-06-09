/**
 * 開発・動作確認用のダミーデータ投入スクリプト。
 *
 * - 既存テナント (最初の 1 件、または INITIAL_TENANT_SLUG) に紐付けて生成する。
 * - RLS をバイパスする必要があるため DIRECT_URL (postgres) で接続する (seed.ts と同方針)。
 * - すべてのダミーは memo 等に「［ダミー］」マーカーを付け、後で識別・一括削除しやすくする。
 * - 二重投入防止: 既にダミー世帯が存在する場合は中断する (FORCE_DUMMY=1 で強制続行)。
 *
 * 実行: pnpm exec dotenv -e .env -- tsx prisma/dummy-seed.ts
 */

import {
  PrismaClient,
  DateOfDeathPrecision,
  PreparationStatus,
  GravePlotType,
  GravePlotStatus,
  TransactionCategory,
  TransactionDirection,
  InteractionKind,
} from "@prisma/client";

const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL },
  },
});

const MARK = "［ダミー］";

// ---- 乱数ユーティリティ ----
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T;
}
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function chance(p: number): boolean {
  return Math.random() < p;
}
/** @db.Date 用。コードベース慣習に合わせ UTC 0時で作る。 */
function dateOnly(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d));
}
/** DateTime 用 (法要等)。ローカル(JST)時刻で作る。 */
function dateTime(y: number, m: number, d: number, hh: number, mm: number): Date {
  return new Date(y, m - 1, d, hh, mm);
}

// ---- 名前データ (姓・名とふりがな) ----
const SURNAMES: ReadonlyArray<[string, string]> = [
  ["佐藤", "さとう"], ["鈴木", "すずき"], ["高橋", "たかはし"], ["田中", "たなか"],
  ["渡辺", "わたなべ"], ["伊藤", "いとう"], ["山本", "やまもと"], ["中村", "なかむら"],
  ["小林", "こばやし"], ["加藤", "かとう"], ["吉田", "よしだ"], ["山田", "やまだ"],
  ["佐々木", "ささき"], ["山口", "やまぐち"], ["松本", "まつもと"], ["井上", "いのうえ"],
  ["木村", "きむら"], ["林", "はやし"], ["清水", "しみず"], ["斎藤", "さいとう"],
  ["山崎", "やまざき"], ["森", "もり"], ["池田", "いけだ"], ["橋本", "はしもと"],
  ["阿部", "あべ"], ["石川", "いしかわ"], ["前田", "まえだ"], ["藤田", "ふじた"],
  ["後藤", "ごとう"], ["岡田", "おかだ"], ["長谷川", "はせがわ"], ["村上", "むらかみ"],
];
const GIVEN_M: ReadonlyArray<[string, string]> = [
  ["太郎", "たろう"], ["一郎", "いちろう"], ["健一", "けんいち"], ["和夫", "かずお"],
  ["茂", "しげる"], ["勇", "いさむ"], ["正雄", "まさお"], ["博", "ひろし"],
  ["清", "きよし"], ["稔", "みのる"], ["大輔", "だいすけ"], ["翔太", "しょうた"],
  ["健太", "けんた"], ["浩二", "こうじ"], ["隆", "たかし"],
];
const GIVEN_F: ReadonlyArray<[string, string]> = [
  ["花子", "はなこ"], ["幸子", "さちこ"], ["美智子", "みちこ"], ["和子", "かずこ"],
  ["洋子", "ようこ"], ["京子", "きょうこ"], ["恵子", "けいこ"], ["真由美", "まゆみ"],
  ["陽子", "ようこ"], ["久美子", "くみこ"], ["さくら", "さくら"], ["愛", "あい"],
  ["千代", "ちよ"], ["梅", "うめ"], ["トメ", "とめ"],
];
const RELATIONS_LIVING = ["配偶者", "長男", "長女", "次男", "次女", "母", "父"];

// ---- 戒名生成 ----
const INGO = ["徳", "光", "浄", "慈", "法", "妙", "宗", "玄", "蓮", "華", "雲", "鶴"];
const DOGO = ["相", "智", "道", "清", "心", "翁", "室", "庵", "院"];
const KAIMYO_CHAR = ["善", "信", "正", "観", "了", "性", "明", "順", "寿", "安"];
const IGO_M = ["居士", "信士", "禅定門"];
const IGO_F = ["大姉", "信女", "禅定尼"];
function makeKaimyo(isMale: boolean): string {
  const igo = isMale ? pick(IGO_M) : pick(IGO_F);
  return `${pick(INGO)}${pick(DOGO)}院${pick(KAIMYO_CHAR)}${pick(KAIMYO_CHAR)}${igo}`;
}

const CITIES = ["市原市", "千葉市緑区", "市原市五井", "茂原市", "袖ケ浦市", "木更津市"];
function makeAddress(): string {
  return `千葉県${pick(CITIES)}${randInt(1, 5)}丁目${randInt(1, 30)}-${randInt(1, 20)}`;
}
function makePostal(): string {
  return `${randInt(100, 299)}-${String(randInt(0, 9999)).padStart(4, "0")}`;
}
function makePhone(): string {
  return `0436-${String(randInt(20, 99)).padStart(2, "0")}-${String(randInt(0, 9999)).padStart(4, "0")}`;
}
function makeMobile(): string {
  return `090-${String(randInt(1000, 9999))}-${String(randInt(0, 9999)).padStart(4, "0")}`;
}

const NENKI_NAMES = ["一周忌", "三回忌", "七回忌", "十三回忌", "十七回忌", "二十三回忌", "三十三回忌"];
const PLOT_PLANS = ["普通区画 4聖地", "夫婦区画 2聖地", "個人区画 1聖地", "永代供養 合祀", "納骨堂 ロッカー式"];

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: process.env.INITIAL_TENANT_SLUG ? { slug: process.env.INITIAL_TENANT_SLUG } : undefined,
    orderBy: { createdAt: "asc" },
  });
  if (!tenant) {
    throw new Error("テナントが見つかりません。先に pnpm db:seed を実行してください。");
  }
  const tenantId = tenant.id;
  console.log(`対象テナント: ${tenant.name} (id=${tenantId})`);

  const existing = await prisma.household.count({
    where: { tenantId, memo: { contains: MARK } },
  });
  if (existing > 0 && process.env.FORCE_DUMMY !== "1") {
    console.log(`既にダミー世帯が ${existing} 件あります。二重投入を避けるため中断します (再投入は FORCE_DUMMY=1)。`);
    return;
  }

  const adminUser = await prisma.user.findFirst({ where: { tenantId } });
  const authorId = adminUser?.id ?? null;

  // ---- 墓地エリア ----
  const areaDefs = [
    { name: `東墓地${MARK}`, sortOrder: 1 },
    { name: `西墓地${MARK}`, sortOrder: 2 },
    { name: `永代供養区${MARK}`, sortOrder: 3 },
  ];
  const areas = [];
  for (const a of areaDefs) {
    areas.push(
      await prisma.gravePlotArea.create({
        data: { tenantId, name: a.name, sortOrder: a.sortOrder, canvasWidth: 1200, canvasHeight: 800 },
      }),
    );
  }
  console.log(`墓地エリア: ${areas.length} 件`);

  const thisYear = new Date().getFullYear();
  let plotSeq = 1;
  let householdCount = 0;
  let personCount = 0;
  let deathCount = 0;
  let serviceCount = 0;
  let plotCount = 0;
  let txnCount = 0;
  let noteCount = 0;
  let tobaCount = 0;

  const HOUSEHOLDS = 32;
  for (let h = 0; h < HOUSEHOLDS; h++) {
    const [sName, sKana] = pick(SURNAMES);
    const headIsMale = chance(0.75);
    const [gName, gKana] = headIsMale ? pick(GIVEN_M) : pick(GIVEN_F);
    const isActive = !chance(0.08); // 約8% を離檀世帯に

    const household = await prisma.household.create({
      data: {
        tenantId,
        householderName: `${sName} ${gName}`,
        nameKana: `${sKana}${gKana}`,
        postalCode: makePostal(),
        address: makeAddress(),
        phone: chance(0.9) ? makePhone() : null,
        mobile: chance(0.7) ? makeMobile() : null,
        email: chance(0.3) ? `${sKana}@example.com` : null,
        secondaryContact: chance(0.3) ? `長男 ${sName}${pick(GIVEN_M)[0]}（携帯 ${makeMobile()}）` : null,
        memo: `${MARK}${isActive ? "" : " 令和に入り離檀"}`,
        isActive,
      },
    });
    householdCount++;

    // 当主 (存命)
    await prisma.person.create({
      data: {
        tenantId,
        householdId: household.id,
        name: `${sName} ${gName}`,
        nameKana: `${sKana}${gKana}`,
        familyRelation: "世帯主",
        birthDate: dateOnly(thisYear - randInt(45, 85), randInt(1, 12), randInt(1, 28)),
        isDeceased: false,
      },
    });
    personCount++;

    // 存命の家族 0-2 名
    const livingFamily = randInt(0, 2);
    for (let i = 0; i < livingFamily; i++) {
      const male = chance(0.5);
      const [fn, fk] = male ? pick(GIVEN_M) : pick(GIVEN_F);
      await prisma.person.create({
        data: {
          tenantId,
          householdId: household.id,
          name: `${sName} ${fn}`,
          nameKana: `${sKana}${fk}`,
          familyRelation: pick(RELATIONS_LIVING),
          birthDate: dateOnly(thisYear - randInt(20, 80), randInt(1, 12), randInt(1, 28)),
          isDeceased: false,
        },
      });
      personCount++;
    }

    // 故人 1-2 名 (過去帳)
    const deceasedCount = randInt(1, 2);
    for (let i = 0; i < deceasedCount; i++) {
      const male = chance(0.5);
      const [fn, fk] = male ? pick(GIVEN_M) : pick(GIVEN_F);
      const deceasedPerson = await prisma.person.create({
        data: {
          tenantId,
          householdId: household.id,
          name: `${sName} ${fn}`,
          nameKana: `${sKana}${fk}`,
          familyRelation: male ? pick(["父", "祖父", "夫"]) : pick(["母", "祖母", "妻"]),
          isDeceased: true,
        },
      });
      personCount++;

      // 没年月日の精度をばらけさせる
      const r = Math.random();
      let precision: DateOfDeathPrecision;
      let dYear: number | null;
      let dMonth: number | null;
      let dDay: number | null;
      if (r < 0.7) {
        precision = DateOfDeathPrecision.FULL;
        dYear = thisYear - randInt(0, 60);
        dMonth = randInt(1, 12);
        dDay = randInt(1, 28);
      } else if (r < 0.85) {
        precision = DateOfDeathPrecision.YEAR_MONTH;
        dYear = thisYear - randInt(30, 90);
        dMonth = randInt(1, 12);
        dDay = null;
      } else if (r < 0.96) {
        precision = DateOfDeathPrecision.YEAR;
        dYear = randInt(1868, thisYear - 60); // 明治以降〜
        dMonth = null;
        dDay = null;
      } else {
        precision = DateOfDeathPrecision.UNKNOWN;
        dYear = null;
        dMonth = null;
        dDay = null;
      }
      const fullDate = precision === DateOfDeathPrecision.FULL && dYear && dMonth && dDay
        ? dateOnly(dYear, dMonth, dDay)
        : null;

      await prisma.deathLedgerEntry.create({
        data: {
          tenantId,
          personId: deceasedPerson.id,
          kaimyoName: chance(0.92) ? makeKaimyo(male) : null,
          secularName: `${sName} ${fn}`,
          dateOfDeath: fullDate,
          deathYear: dYear,
          deathMonth: dMonth,
          deathDay: dDay,
          datePrecision: precision,
          ageAtDeath: chance(0.85) ? randInt(55, 99) : null,
          burialLocation: chance(0.7) ? `${pick(["東", "西"])}墓地 ${randInt(1, 30)}番` : null,
          memorialCutoffAnniversary: chance(0.2) ? pick([33, 50]) : null,
          memo: MARK,
        },
      });
      deathCount++;
    }

    // 区画 (約75%の世帯が契約)
    if (chance(0.75)) {
      const area = pick(areas);
      await prisma.gravePlot.create({
        data: {
          tenantId,
          householdId: household.id,
          areaId: area.id,
          plotNumber: `${MARK.slice(1, 2)}${String(plotSeq).padStart(3, "0")}`,
          plotType: pick([
            GravePlotType.FAMILY, GravePlotType.COUPLE, GravePlotType.INDIVIDUAL,
            GravePlotType.ETERNAL_MEMORIAL, GravePlotType.OSSUARY,
          ]),
          status: GravePlotStatus.IN_USE,
          contractDate: dateOnly(thisYear - randInt(1, 40), randInt(1, 12), randInt(1, 28)),
          contractPlan: pick(PLOT_PLANS),
          positionX: randInt(0, 10) * 96,
          positionY: randInt(0, 6) * 96,
          memo: MARK,
        },
      });
      plotSeq++;
      plotCount++;
    }

    // 法要 (約55%)
    if (chance(0.55)) {
      const future = chance(0.6);
      const y = future ? thisYear : thisYear - randInt(0, 1);
      const mo = randInt(1, 12);
      const d = randInt(1, 28);
      const svc = await prisma.memorialService.create({
        data: {
          tenantId,
          householdId: household.id,
          serviceName: pick(NENKI_NAMES),
          scheduledAt: dateTime(y, mo, d, pick([10, 11, 13, 14]), pick([0, 30])),
          location: pick(["本堂", "墓前", "自宅"]),
          attendeeCount: chance(0.8) ? randInt(3, 25) : null,
          tobaCount: chance(0.6) ? randInt(1, 5) : null,
          offeringAmount: chance(0.7) ? randInt(3, 10) * 10000 : null,
          preparationStatus: future
            ? pick([PreparationStatus.TENTATIVE, PreparationStatus.CONFIRMED])
            : PreparationStatus.DONE,
          assignedUserId: authorId,
          memo: MARK,
        },
      });
      serviceCount++;

      // 塔婆 (法要に 0-3 本)
      const tobas = randInt(0, 3);
      for (let t = 0; t < tobas; t++) {
        await prisma.toba.create({
          data: {
            tenantId,
            memorialServiceId: svc.id,
            householdId: household.id,
            applicantName: `${sName} ${gName}`,
            count: 1,
            inscription: `為 ${sName}家先祖代々之霊位`,
            readingOrder: t,
            memo: MARK,
          },
        });
        tobaCount++;
      }
    }

    // 会計 (世帯ごと 1-3 件: 護持会費・御布施 等)
    const txns = randInt(1, 3);
    for (let t = 0; t < txns; t++) {
      const cat = pick([
        TransactionCategory.MAINTENANCE_FEE,
        TransactionCategory.OFFERING,
        TransactionCategory.DONATION,
      ]);
      await prisma.transaction.create({
        data: {
          tenantId,
          householdId: household.id,
          category: cat,
          amount:
            cat === TransactionCategory.MAINTENANCE_FEE
              ? pick([5000, 8000, 10000, 12000])
              : randInt(1, 10) * 10000,
          direction: TransactionDirection.INCOME,
          paidAt: dateOnly(thisYear, randInt(1, 12), randInt(1, 28)),
          paymentMethod: pick(["現金", "振込", "郵便振替"]),
          memo: `${MARK}${cat === TransactionCategory.MAINTENANCE_FEE ? " 年会費" : ""}`,
        },
      });
      txnCount++;
    }

    // 対応履歴 (約70%の世帯に 1-2 件)
    if (chance(0.7)) {
      const notes = randInt(1, 2);
      for (let n = 0; n < notes; n++) {
        await prisma.interactionNote.create({
          data: {
            tenantId,
            householdId: household.id,
            authorId,
            kind: pick([
              InteractionKind.PHONE, InteractionKind.VISIT,
              InteractionKind.CONVERSATION, InteractionKind.NOTE,
            ]),
            content: pick([
              "次回法要の日程について相談を受けた。後日折り返し連絡予定。",
              "お墓の清掃について問い合わせ。年内に一度ご来寺いただく予定。",
              "ご家族に体調を崩された方あり。法要は椅子席を用意することに。",
              "護持会費の納入方法を郵便振替へ変更希望。次回より対応。",
              "お盆の棚経の時間帯について確認の電話あり。午前希望。",
            ]) + MARK,
            occurredAt: dateTime(thisYear, randInt(1, 12), randInt(1, 28), randInt(9, 17), 0),
          },
        });
        noteCount++;
      }
    }
  }

  // ---- 寺側の経費 (世帯紐付けなし) を数件 ----
  const expenses: Array<[TransactionCategory, string, number]> = [
    [TransactionCategory.EXPENSE, "本堂 電気代", 28000],
    [TransactionCategory.EXPENSE, "墓地 除草作業 委託", 65000],
    [TransactionCategory.EXPENSE, "案内状 印刷・郵送", 42000],
    [TransactionCategory.EXPENSE, "庭木 剪定", 80000],
    [TransactionCategory.EVENT_FEE, "彼岸会 会場費", 35000],
  ];
  for (const [cat, label, amt] of expenses) {
    await prisma.transaction.create({
      data: {
        tenantId,
        category: cat,
        amount: amt,
        direction: TransactionDirection.EXPENSE,
        paidAt: dateOnly(thisYear, randInt(1, 12), randInt(1, 28)),
        paymentMethod: pick(["現金", "振込"]),
        memo: `${MARK} ${label}`,
      },
    });
    txnCount++;
  }

  // ---- 空き/予約区画も数件 (地図確認用) ----
  for (let i = 0; i < 8; i++) {
    const area = pick(areas);
    await prisma.gravePlot.create({
      data: {
        tenantId,
        areaId: area.id,
        plotNumber: `${MARK.slice(1, 2)}${String(plotSeq).padStart(3, "0")}`,
        plotType: pick([GravePlotType.FAMILY, GravePlotType.INDIVIDUAL]),
        status: chance(0.5) ? GravePlotStatus.AVAILABLE : GravePlotStatus.RESERVED,
        positionX: randInt(0, 10) * 96,
        positionY: randInt(0, 6) * 96,
        memo: MARK,
      },
    });
    plotSeq++;
    plotCount++;
  }

  console.log("=== ダミーデータ投入完了 ===");
  console.log(
    JSON.stringify(
      { 世帯: householdCount, 人物: personCount, 過去帳: deathCount, 法要: serviceCount, 塔婆: tobaCount, 区画: plotCount, 会計: txnCount, 対応履歴: noteCount, 墓地エリア: areas.length },
      null, 2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
