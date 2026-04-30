# ドメイン用語集 (Ubiquitous Language)

本プロジェクトで使用する仏教・寺院運営の専門用語と、コード上での英語表記の対応表。**新たにドメイン語彙を扱う際は、必ずこの対応表に準拠すること**。未定義の用語が出てきたら、このドキュメントに追加してから実装する。

---

## 世帯・檀信徒関連

| 日本語 | コード (English) | 説明 |
| :--- | :--- | :--- |
| 檀家 | `Danka` | 代々特定の寺院に帰依し、お墓を持ち、金銭的支援を行う家 |
| 檀信徒 | `Parishioner` | 檀家に加え、信仰関係を持つ信徒を含めた総称。**本プロダクトの標準呼称** |
| 施主 | `Householder` | 世帯の代表者。法要の主催者 |
| 世帯 | `Household` | 施主を中心とした家族単位。**カルテの基本単位** |
| 家族構成員 | `Person` | 世帯に属する個人（存命・故人問わず） |
| 新規のご縁 | `NewConnection` | 檀家ではないが法要等で縁のある方 |
| 第 2 連絡先 | `SecondaryContact` | 施主不在時の緊急連絡先（子・兄弟等） |

## 過去帳・故人関連

| 日本語 | コード (English) | 説明 |
| :--- | :--- | :--- |
| 過去帳 | `DeathLedger` | 故人の記録簿。**物理削除禁止** |
| 過去帳エントリ | `DeathLedgerEntry` | 過去帳の 1 名分の記録 |
| 戒名 | `KaimyoName` | 故人に授けられる仏弟子としての名。posthumous Buddhist name |
| 俗名 | `SecularName` | 生前の氏名 |
| 没年月日 | `DateOfDeath` | 亡くなった日（和暦・西暦両方を保持） |
| 命日 | `AnniversaryDate` | 年ごとに巡ってくる没日 |
| 行年 | `AgeAtDeath` | 亡くなった時の年齢（数え年） |
| 続柄 | `FamilyRelation` | 世帯主・施主から見た関係（父・母・配偶者・長男・長女 等） |
| 埋葬場所 | `BurialLocation` | 埋葬地（寺内墓地・公営墓地・散骨等） |

## 法要・行事関連

| 日本語 | コード (English) | 説明 |
| :--- | :--- | :--- |
| 法要 | `MemorialService` | 故人の供養儀式 |
| 葬儀 | `Funeral` | 亡くなった直後の儀式 |
| 通夜 | `Wake` | 葬儀前夜の儀式 |
| 四十九日 | `FortyNinthDay` | 没後 49 日目の法要 |
| 一周忌 | `FirstAnniversary` | 没後 1 年 |
| 年忌 | `MemorialAnniversary` | 一周忌以降の周期法要 |
| 年忌法要 | `AnniversaryMemorialService` | 年忌として行う法要 |
| 月命日 | `MonthlyAnniversary` | 毎月の命日（希望者のみ勤める） |
| お彼岸 | `Higan` | 春分・秋分前後の 1 週間 |
| お盆 | `Bon` | 先祖供養の行事 |
| 塔婆 | `Toba` | 法要時に立てる木製の供養塔 |
| 御布施 | `Offering` | 法要等に対するお布施 |
| 御供物 | `OfferingGoods` | お供え物 |
| 参拝者 | `Attendee` | 法要参加者 |
| 行事 | `TempleEvent` | 法要以外の寺院行事（除夜の鐘等） |

## お墓・区画関連

| 日本語 | コード (English) | 説明 |
| :--- | :--- | :--- |
| お墓 | `Grave` | お墓全般 |
| 区画 | `GravePlot` | 墓地内の 1 区画 |
| 区画番号 | `PlotNumber` | 区画の識別番号 |
| 個人墓 | `IndividualGrave` | 1 人用 |
| 夫婦墓 | `CoupleGrave` | 夫婦用 |
| 家族墓 | `FamilyGrave` | 家族代々 |
| 永代供養墓 | `EternalMemorialGrave` | 永代供養 |
| 納骨堂 | `Ossuary` | 遺骨を納める建物 |
| 合祀 | `CombinedEnshrinement` | 複数名を 1 つの墓・施設で供養 |
| 墓じまい | `GraveClosing` | お墓の撤去・返却 |
| 契約プラン | `GraveContractPlan` | 区画の契約形態 |

## 会計関連

| 日本語 | コード (English) | 説明 |
| :--- | :--- | :--- |
| 会計 | `Accounting` | 収支全般 |
| 護持会費 | `MaintenanceFee` | 檀信徒が毎年納める会費 |
| 入金 | `Payment` | 収入 |
| 支払 | `Expense` | 支出 |
| 費目 | `AccountingCategory` | 会費・布施・寄付・修繕費 等 |
| 既納 / 未納 | `Paid` / `Unpaid` | 納入済 / 未納 |
| 寄付 | `Donation` | 寄進 |

## システム・テナント関連

| 日本語 | コード (English) | 説明 |
| :--- | :--- | :--- |
| 寺院 (テナント) | `Tenant` | 1 つのお寺 = 1 テナント |
| 寺族 | `TempleStaff` | 住職・副住職・事務員等 |
| 住職 | `HeadPriest` | 寺院の代表者 |
| 利用者 | `User` | システムにログインする人 |
| 伝言メモ | `InteractionNote` | 檀信徒との会話・訪問記録 |
| 履歴 | `History` | 時系列記録 |
| 書類 | `Document` | 契約書・案内状等 |

## 日付・暦関連

| 日本語 | コード (English) | 説明 |
| :--- | :--- | :--- |
| 和暦 | `Wareki` | 元号年 (令和 6 年等) |
| 西暦 | `Seireki` | グレゴリオ暦 (2024 年等) |

---

## 命名規則

- **英語識別子は上記対応表を使用**。同一概念に複数の英語を混ぜない。
- **UI 文言は日本語**。伝統的な寺院用語を優先する。
- **略語は避ける**。例: `MS` (MemorialService) は禁止、`memorialService` と明示する。
- **複数形の使い方**: TypeScript の型は単数 (`MemorialService`)、コレクション変数は複数 (`memorialServices`)。
