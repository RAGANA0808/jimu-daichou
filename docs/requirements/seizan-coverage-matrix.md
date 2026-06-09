# せいざん「寺務台帳」網羅マトリクス × 自社コード棚卸し（クリティック追補版）

最終更新: 2026-06-07
出典: せいざん「寺務台帳」概要HTML 全12セクション＋スクリーンショット22枚／自社コード棚卸し（`apps/web/src/` 配下を直接 Grep／`prisma/schema.prisma` 全734行精読／`docs/requirements/feature-backlog.md` E01〜E35／`docs/legal/patent-analysis.md`）
作成: プロダクトアナリスト（網羅性クリティック）
凡例（状態）: ✅実装済 / 🟡部分実装 / ❌未実装

> 本書は統合ドラフト A) を批判的に再点検し、(1) せいざん12セクションの取りこぼし細目の追加、(2) 「実装済」判定の裏取りと**誤判定の訂正**、(3) データモデル上の見落とし、(4) 特許リスクの見落とし、を追補した最終版である。
> **パス表記の訂正**: ドラフトは `lib/...` `features/...` と書くが、実体は全て `apps/web/src/` 配下（例: `apps/web/src/lib/search/queries.ts`）。本書は実パスに統一する。

---

## 0. クリティック・サマリ（ドラフトに対する主要な修正・追補）

### 0.1 「実装済/未実装」判定の訂正（裏取り結果）

| 項目 | ドラフトの主張 | 裏取り結果 | 判定 |
| :-- | :-- | :-- | :-- |
| 第2連絡先のフォーム入力（C-3） | 「secondaryContactは1行自由記述、**かつフォームに入力欄が無くUIから編集不能**」 | **誤り。** `apps/web/src/features/danshintoto/HouseholdForm.tsx:190-197` に「第 2 連絡先」TextField が存在し、`actions.ts:29/58/74` で読取・検証(120字)・保存され、詳細(`[id]/page.tsx:148`)・編集(`[id]/edit/page.tsx:54`)・CSV(`lib/export/entities/household.ts:21`)にも通っている。**UIから編集可能**。 | **C-3「即効修正」は不要。** 残る欠落は「1行自由記述ゆえ多階層・構造化できない」点のみ（C-2に一本化）。ドラフトのP0「第2連絡先フォーム入力」は削除し、Wave P0-FOUNDATIONから外す |
| Document（書類保管） | 「定義済だがアプリ実装ゼロ」 | **正しい。** `Document` テーブルへのアプリ側アクセス（`prisma.document` / Storage アップロード / 一覧 / プレビュー）は**1件もヒットせず**。`features/**/pdf/*` のヒットは `@react-pdf/renderer` の `Document` コンポーネント（別物）のみ。 | 主張維持。**ただし重大な追補あり（下記0.3）** |
| RBAC | 「role保持・表示のみ、READ_ONLYでも全操作可」 | **正しい。** `UserRole` は `features/account/roles.ts` のラベル表示でのみ使用。`requireRole`/`canEdit`/`hasPermission`/`role===`等のガードは**1件もヒットせず**。Server Action にロール検査は無い。 | 主張維持。優先度の妥当性も確認 |
| assignedUserId（巡回/シフト） | 「列はあるがコードから一切未使用」 | **正しい。** `MemorialService.assignedUserId`（schema 226行）への参照は features/app/lib に**ゼロ**。 | 主張維持 |
| カレンダー双方向 | 「events.list/webhook無し＝一方向push」 | **正しい。** `lib/google/calendar.ts` は insert/update/delete のみ。`events.list`/`watch`/`webhook` は無し。 | 主張維持。**ただしセキュリティ追補あり（下記0.4）** |
| 過去帳の戒名順ソート | 「過去帳=命日/かな順のみ（戒名順無し）」 | **正しい。** `kaimyoName` はフォーム・検索条件でのみ使用。一覧のソートキーに `kaimyoName` は無い。 | 主張維持 |
| 苗字逆引き（区画） | 「`lib/search/queries.ts` にGravePlot未統合」 | **正しい。** `search()` は `searchHouseholds` と `searchDeathLedgerEntries` の2ブロックのみ。GravePlot は検索対象外。`GravePlot` に墓標名/刻名カラムも無い（schema 284-311行）。 | 主張維持 |
| 過去帳⇄区画リンク（Burial） | 「GravePlotはhouseholdId止まり、埋蔵リンク無し」 | **正しい。** `GravePlot` の relation は household/area/管理料のみ。`Burial` モデルは**存在しない**（CLAUDE.md ドメイン用語集には `Burial` の定義があるが schema 未実装＝設計意図と実装の乖離）。`DeathLedgerEntry.burialLocation` は自由記述文字列のみ。 | 主張維持。**芋づる欠落の根として正しい** |

### 0.2 せいざン12セクションの「取りこぼし細目」追加（ドラフトA)に未掲載だった行）

ドラフトA) のマトリクスに**載っていなかった**せいざんの訴求細目を以下に追加し、本書の各§表へ組み込んだ。

1. **§1 同時接続（複数端末の同時編集・競合）** — ドラフトは「同時接続=RBAC実効が未配線」とだけ触れるが、**同時編集時の楽観ロック/競合検知**という観点が抜けていた → §1に追加（❌）。
2. **§2 没年→「今年該当/次回何年後」の"何年後"明示** — 年忌自動計算は✅だが、せいざんが強調する「**次回まであと何年**」のカウントダウン表示の有無を独立確認 → §2に明記。
3. **§3 過去帳データ連携＝「納骨使用者を自動表示」の双方向性** — ドラフトはGravePlot→故人を挙げるが、**カルテ(世帯)→そのお墓に入っている故人一覧**というカルテ側起点の表示要件を独立行に → §3に追加。
4. **§4 カスタムラベルでの"絞り込み"（ラベル横断の対象抽出）** — タグ✅だが「**ラベルで履歴/家を絞り込む**」操作の完成度を独立確認 → §4に明記。
5. **§8 CSVダウンロードで"外注"（宛名書き等の外部委託前提のエクスポート様式）** — エンジンは✅だが「外注向けレイアウト（宛名/年忌表）」という用途明示が抜けていた → §8に追記。
6. **§9 区画マップの"図面再現"（実レイアウトの忠実再現＝背景画像）** — ドラフトはP2で触れるが、せいざんの主要訴求として独立行で明示 → §9（🟡）。
7. **§10 行事管理＝シフト表（担当者×日付の人員配置表そのもの）** — 巡回ルートと別に「**シフト表という成果物**」要件を独立行に → §10に追加（❌）。
8. **§12 リスク可視化の"将来の檀家減少リスク"（人口動態的な先細り予測）** — ドラフトのZ-3に内包されるが、せいざんの明示訴求として§12に独立行で残す。

### 0.3 データモデル上の見落とし（ドラフトに無い追補）

- **D-1 Document の紐付け先不足**: 現 `Document` モデルは `householdId?` のみ（schema 444-459行）。ドラフトB)D-1は「カルテ/**区画/会計**に添付」と謳うが、**区画(GravePlot)・会計(Transaction)・過去帳(DeathLedgerEntry)への外部キーが無い**。E17実装時は `Document` に `gravePlotId?` / `transactionId?` / `deathLedgerEntryId?`（いずれもnullable・排他or併存）＋ `uploadedById` の追加マイグレーションが必須。ドラフトの「Documentモデル既存ゆえスキーマ変更不要」は**誤り**（Storage連携は不要でも紐付け列は要追加）。
- **Document に論理削除・監査列が無い**: 戒名授与書・申込書等は歴史的書類。過去帳に準じ `deletedAt`/`deletedBy` を持たせるか方針確定が必要（追補）。
- **承継(代替わり)の履歴モデルが無い**: G-8/E10で承継を扱うが、`Household` に「歴代施主の履歴」を残すモデル/列が無い（現状 `householderName` 上書き）。承継ウィザード実装前に `HouseholdSuccession`（旧施主/新施主/承継日/承認者）の新設が要件。**特許回避(手動承認)の証跡としても必須**。
- **ShipmentBatch に「年忌種別/対象期間」の構造が薄い**: 重複案内防止(A-2)を機械判定するには、ShipmentRecipient に「対象故人ID・年忌回次」を構造保持する必要（現 `summary` は文字列のみ、schema 502-503行）。突合キーが文字列だと既送判定が脆い → A-2実装時に `targetPersonId`/`anniversaryNo` 列追加を検討（追補）。
- **会費/管理料の「改定理由」トレース弱**: F-6で触れるが、年額スナップショットはあっても改定理由の構造が無い（追補・優先度低）。

### 0.4 特許リスクの見落とし（ドラフトC-4に対する追補）

ドラフトC-4の回避線（更新順ポータル/施主死亡自動設定/命日基準+オンライン参拝/遠隔墓参/商標）は `patent-analysis.md` と整合し妥当。**ただし以下の見落とし・要強化点**がある。

1. **【新規・要注意】T-4 巡回ルートDnD ⇔ P8（YMFG「地図上で墓参ルート登録」JP2022036640A）の接近**。ドラフトのT-4(E30)/UI-Cは「区画地図DnD資産を転用して訪問順を組む」とするが、これは**「地図DB上で起点・目標点を指定し墓参ルートを登録」するP8の構成に表面上接近**する。`patent-analysis.md` §3も「地図上の墓参ルート登録機能を作るなら P8 の請求項を要確認」と明記。**回避線**: 巡回順は「**地図上のルート描画/最適経路登録**」ではなく「**訪問先リストの並べ替え（順序付きリスト）**」に留め、地図への経路ライン描画機能を作らない。ドラフトには未記載だったため C) 回避表に追加すべき。
2. **【新規・セキュリティ】googleRefreshToken の平文保存**。`Tenant.googleRefreshToken` は暗号化されず平文で保存（schema 32-34行）。特許ではないが、ドラフトはこれをT-2(P2)の「双方向同期＋暗号化」に同梱しPhase2送りにしている。**OAuth refresh_token の平文保存は現時点の保全リスク**であり、双方向同期と切り離して前倒し（PERMISSION/P0-FOUNDATION相当）で暗号化(at-rest)すべき。追補。
3. **【強化】Z-1/Z-3 ダッシュボードの「更新順」**。回避線は明記済みだが、**経年トレンド(Z-3)で「最近更新された世帯/契約」を時系列で並べるカードを作ると P1請求項(4)の"更新順動的表示"に接近**しうる。Z-3は「**集計値の経年比較（折れ線/棒）**」に限定し、「更新順に並ぶ行リスト」をダッシュボードの主構成にしないことを明記（追補）。
4. **【確認】A-1 条件抽出→一括生成は「手動トリガ」を維持**。ドラフトA-3で明記済みだが、A-1(条件抽出)とA-4(合祀案内)も「抽出→**人手確認**→生成」を崩さないこと（TERA P5/Classix P6 の自動発送パイプライン回避）を各所で再確認。
5. **【商標】「檀信徒カルテ」「寺務台帳」の対外使用**。ドラフトC-4最終行で扱うが、**本プロジェクトの内部コード名・ドキュメント(CLAUDE.md)が「檀信徒カルテ/寺務台帳」を多用**している現実を踏まえ、対外ブランド確定前の弁理士FTO（`patent-analysis.md` §5-4/5-7）をロードマップの非機能タスクとして明示すべき（追補）。

---

## A) 網羅マトリクス（せいざん全機能 × 我々の状態 × 該当ファイル × ギャップ × 対応方針）

> 行＝せいざん12セクションの細目。0.2で追加した取りこぼし細目を **[追補]** で明示。パスは実体（`apps/web/src/`）に統一。

### §1 ログイン〜検索（マルチデバイス / 高速サジェスト / 電話逆引き）

| せいざん細目 | 我々 | 該当ファイル | ギャップ | 対応方針 |
| :-- | :--: | :-- | :-- | :-- |
| 完全クラウド/レスポンシブ/同時接続 | 🟡 | `app/(main)/layout.tsx`, `app/globals.css`, `tailwind.config` | レスポンシブ方針は確定だが横長テーブルのカード化が全画面に未徹底 | UI-4で一覧テーブル⇄カード出し分けを全画面徹底 |
| **[追補] 同時編集時の競合検知（楽観ロック）** | ❌ | `prisma/schema.prisma`（`updatedAt` はあるがロック未使用） | 複数端末同時編集時の上書き競合を検知/警告する仕組みが無い | 主要フォームに `updatedAt` ベースの楽観ロック（保存前バージョン突合）。優先度P2 |
| マルチテナント入口（テナント選択/切替） | 🟡 | `lib/db/`(withTenant), `prisma/schema.prisma`（全モデルtenantId） | 分離基盤は完備。複数テナント選択UI/切替はPhase2未実装（自寺単一運用） | Phase2: テナント招待・切替UI |
| ひらがな1文字での高速サジェスト/インクリメンタル | 🟡 | `features/search/SearchBar.tsx`, `lib/search/normalize.ts`, `lib/search/queries.ts`, `app/api/search/route.ts` | 前方一致優先・上位8件は満たすが、最近閲覧/頻度ランキング・濁点/小書きゆれ吸収は未対応 | サジェストにランキングと読みゆれ正規化を追加（B§検索 P1） |
| 電話番号逆引き（着信番号→誰か特定） | 🟡 | `lib/search/queries.ts`（phone/mobile `regexp_replace` 部分一致） | 検索バー手入力での逆引きは成立。着信ポップアップ/CTI連携は未実装 | 手入力逆引きで要件充足。CTIはP2 |
| 苗字逆引き（墓標名≠使用者苗字でも特定） | ❌ | `lib/search/queries.ts`, `prisma/schema.prisma`(GravePlot) | GravePlotに墓標名/刻名カラム無し、`search()`にGravePlotブロック無し | GravePlotに墓標名/刻名追加＋`search()`にGravePlotブロック追加（B§区画 P1） |

### §2 檀家カルテ（基本）— 年忌自動計算 / 多階層連絡先 / 家メモ

| せいざん細目 | 我々 | 該当ファイル | ギャップ | 対応方針 |
| :-- | :--: | :-- | :-- | :-- |
| カルテ1ページ集約 | ✅ | `app/(main)/danshintoto/[id]/page.tsx` | 連絡先/タグ/履歴/過去帳/法要/区画/会費/入出金を1ページ集約済 | UI-4で詳細をタブ化 |
| 年忌自動計算（没年→今年該当） | ✅ | `lib/nenki/calculate.ts`, `features/kakochou/NenkiBadges.tsx` | 閏日補正・弔い上げ・和暦西暦併記まで実装。せいざん同等以上 | 維持 |
| **[追補] 次回まで「あと何年」カウントダウン表示** | 🟡 | `features/kakochou/NenkiBadges.tsx` | 該当回忌バッジは出るが「次回◯回忌まであと◯年」の明示文言の徹底は要確認 | バッジに次回までの年数を明示（安価・UI層）。B§年忌 |
| 家メモ（引き継ぎ用注意事項） | ✅ | `prisma/schema.prisma`(Household.memo:114行), `app/(main)/danshintoto/[id]/page.tsx` | 単一自由記述で表示・編集可 | カルテ最上部への昇格（UI-4） |
| 多階層連絡先（第2連絡先/孫世代まで人数無制限） | ❌ | `Household.secondaryContact`(113行・1行自由記述), `Person`(個人連絡先列なし) | **secondaryContactは入力欄・保存・表示・CSVまで配線済（ドラフトの"入力欄なし"は誤り）だが、1行自由記述ゆえ多階層化不可。Personに電話/メール/優先連絡フラグが無い。** これが最大の構造欠落 | `ContactPoint`モデル新設（tenantId+household/personId, label, value, priority, canContact）。Household/Personに1対多（B§カルテ P1） |
| 関連する家（分家/縁戚リンク） | ❌ | — | 世帯間の関連リンク構造が無い | `HouseholdRelation`の検討（P2） |

### §3 カルテ（会費・契約）— 会費一元管理 / 契約プラン可視化 / 過去帳連携

| せいざん細目 | 我々 | 該当ファイル | ギャップ | 対応方針 |
| :-- | :--: | :-- | :-- | :-- |
| 会費の金額/支払状況一元管理 | ✅ | `features/gojikai/queries.ts`, `lib/gojikai/calc.ts`, `prisma/schema.prisma`(MaintenanceFeePlan/Invoice) | 台帳→年度請求→消込→会計起票→未収抽出→督促まで一気通貫 | 維持。カルテの会費サマリ可視性向上 |
| 墓地管理料（区画単位） | ✅ | `features/bochi/queries.ts`, `lib/bochi/calc.ts`, `prisma/schema.prisma`(GraveMaintenancePlan/Invoice) | 滞納集計・催告状PDFまで完備 | 維持 |
| 契約プラン可視化（区画/永代供養/預かり年数） | 🟡 | `prisma/schema.prisma`(GravePlot.contractPlan:293行・自由文字列), `features/kukaku/GravePlotForm.tsx` | 預かり年数/満了日/更新が機械可読でない（自由文字列）。満了自動計算・期限アラート不可 | `GraveContract`新設（契約区分enum/永代使用料/許可証番号/安置開始日/安置期間/合祀移行予定日）。満了は純関数算出（B§区画 P1） |
| 過去帳データ連携（区画→納骨使用者を自動表示） | ❌ | `prisma/schema.prisma`(GravePlotはhouseholdId止まり・284-311行) | GravePlot⇄故人(Person/DeathLedgerEntry)の埋蔵リンク無し。`Burial`モデル未実装（CLAUDE.md用語集にはあるが schema に無い） | `Burial`中間モデル新設（tenantId・personId×gravePlotId・納骨日・論理削除）（B§区画 P1, E09） |
| **[追補] カルテ(世帯)→そのお墓の故人一覧（カルテ側起点）** | ❌ | 同上 | Burill欠落により世帯カルテからも納骨者一覧を出せない | Burial実装に内包。カルテ「区画・納骨」タブで世帯×お墓×故人を表示（B§区画 P1） |

### §4 カルテ（タイムライン/履歴）— 法要記録 / 交流履歴 / カスタムラベル

| せいざん細目 | 我々 | 該当ファイル | ギャップ | 対応方針 |
| :-- | :--: | :-- | :-- | :-- |
| 法要・葬儀記録（日時/場所/参拝人数/塔婆本数） | 🟡 | `features/houyou/*`, `prisma/schema.prisma`(MemorialService:attendeeCount/tobaCount/offeringAmount), `features/toba/*` | 法要記録は完備（塔婆は構造化でせいざん超え）。葬儀固有の構造化（導師/会場/会葬者数）が無く法要フォーム流用 | 葬儀は当面 InteractionNote(FUNERAL) で代替。固有構造化はP2 |
| コミュニケーション履歴（細かな交流） | ✅ | `features/danshintoto/InteractionTimeline.tsx`, `interaction-types.ts`, `interaction-queries.ts` | kind×category12・ピン留め・論理削除・絞り込み完備 | 維持 |
| カスタムラベル（自作・絞り込み） | ✅ | `features/danshintoto/interaction-types.ts`(category12), `features/tags/*`(Tag/HouseholdTag) | 履歴カテゴリ＋世帯タグ横断抽出を実装 | 維持 |
| **[追補] ラベルでの絞り込み操作（履歴/家の抽出）** | 🟡 | `features/tags/*`, `InteractionTimeline.tsx` | タグ横断抽出はあるが、履歴カテゴリ×タグの複合絞り込みUIの完成度は要確認 | 複合フィルタの導線整備（UI-4） |
| 法要記録と交流履歴が同一タイムライン | 🟡 | `InteractionTimeline.tsx`, `features/houyou/queries.ts` | InteractionNote(交流)とMemorialService(儀礼)が別レイヤ。せいざんは1タイムラインに混ぜる | カルテ詳細で時系列マージビュー（UI-4、表示層で統合） |

### §5 カルテ（書類・写真・伝言）— ペーパーレス / 伝言板

| せいざん細目 | 我々 | 該当ファイル | ギャップ | 対応方針 |
| :-- | :--: | :-- | :-- | :-- |
| 書類・写真のクラウド保管（申込書/戒名授与書/手紙） | ❌ | `prisma/schema.prisma`(Document:444-459行 定義のみ) | Documentモデル定義済だがアプリ実装ゼロ（アップロード/Storage/一覧/プレビュー全て無し）。**かつ紐付け先がhouseholdId?のみで区画/会計/過去帳に未対応（0.3）** | E17: Supabase Storage連携・添付UI・**Documentに gravePlotId/transactionId/deathLedgerEntryId/uploadedById 列追加**・論理削除方針確定（B§書類 P1） |
| 伝言板（スタッフ間共有） | ✅ | `features/danshintoto/interaction-types.ts`(MESSAGE+isPinned), `InteractionNoteForm.tsx` | MESSAGEカテゴリ＋ピン留めで実質代替。記録者名表示あり | 維持。「対応済チェック」状態管理はP2 |

### §6 スケジュール・Googleカレンダー連携

| せいざん細目 | 我々 | 該当ファイル | ギャップ | 対応方針 |
| :-- | :--: | :-- | :-- | :-- |
| 予定登録→カレンダー自動反映 | ✅ | `lib/google/calendar.ts`, `features/houyou/actions.ts`(syncToCalendar) | best-effort同期・CANCELED削除・冪等処理まで品質高 | 維持 |
| カレンダー予定→カルテへのリンクURL付与 | ✅ | `lib/google/calendar.ts`(buildCalendarEventData) | source/descriptionに`/houyou/{id}`埋込 | 維持 |
| 月/週グリッドの専用カレンダー画面 | 🟡 | `features/dashboard/queries.ts`, `app/(main)/houyou/page.tsx` | 月表示UIは無く、テーブル＋ダッシュボードのリスト俯瞰のみ | P2: 年忌/会費期日/合祀期限を統合した月ビュー |
| カレンダー双方向（取込） | ❌ | `lib/google/calendar.ts`(insert/update/deleteのみ) | events.list/webhook無し＝一方向push | E15: 双方向同期（B§通知 P2） |
| **[追補・セキュリティ] refresh_token の保全** | 🟡 | `prisma/schema.prisma`(Tenant.googleRefreshToken:平文・32-34行), `app/api/google/auth/callback/route.ts` | OAuth refresh_token が**平文保存**。漏洩時にカレンダー権限が悪用されうる | at-rest暗号化を双方向同期と切離して前倒し（B§権限 P1） |
| 終了時刻/所要時間 | 🟡 | `prisma/schema.prisma`(MemorialService.scheduledAt単一・220行) | 終了+1h固定、UI入力欄無し | endTime/duration列追加（安価） |

### §7 履歴・法要の登録アクション — 音声入力 / シンプル登録

| せいざん細目 | 我々 | 該当ファイル | ギャップ | 対応方針 |
| :-- | :--: | :-- | :-- | :-- |
| 下部固定アクションバーからの即時登録 | ✅ | `features/danshintoto/HouseholdActionBar.tsx` | sticky bottom・44px・対応記録/法要/入出金/家族/振替 | 維持 |
| 音声入力での履歴登録 | ❌ | — | SpeechRecognition/MediaRecorder痕跡ゼロ | E19: 長文フィールドにWeb Speech APIマイクボタン（B§モバイル P2） |
| シンプル登録（種別→場所を順選択、寺族/アルバイト可） | ❌ | `features/houyou/MemorialServiceForm.tsx`(フル項目フォーム) | ステップ式ウィザード無し、法要名は自由テキスト（プリセット無し） | 法要名プリセット化＋種別→場所のウィザード（B§法要 P2） |

### §8 檀信徒台帳・過去帳一覧 — 並び替え / CSV / ダイレクト印刷

| せいざん細目 | 我々 | 該当ファイル | ギャップ | 対応方針 |
| :-- | :--: | :-- | :-- | :-- |
| 過去帳横断一覧＋あいまい検索 | ✅ | `app/(main)/kakochou/page.tsx`, `features/kakochou/queries.ts`, `KakochouListControls.tsx` | 命日順/かな順・かな正規化検索・レスポンシブ完備 | 維持 |
| 柔軟な並び替え（戒名順 等） | 🟡 | `features/kakochou/KakochouListControls.tsx`, `app/(main)/danshintoto/page.tsx` | 過去帳=命日/かな順のみ（戒名順無し）。檀信徒一覧=nameKana固定・並び替え無し・上限あり | 戒名順ソート追加（kaimyoNameキー、安価）。一覧の並び替え/ページング整備（B§過去帳 P1） |
| CSVダウンロード（外注用） | ✅ | `lib/export/entities/deathLedger.ts`, `lib/export/entities/household.ts`, `app/(main)/export/page.tsx` | 10列・往復可・BOM付。エンジン完成 | 一覧画面に直接CSV書出ボタンを足す（導線のみ・安価） |
| **[追補] 外注前提のレイアウト出力（宛名/年忌表様式）** | 🟡 | `lib/export/*`, `app/api/nenki/pdf/route.tsx` | 汎用CSVはあるが「宛名書き外注/年忌表手渡し」に最適化した様式が薄い | 年忌表帳票化（B§年忌 P1）で充足 |
| ダイレクト印刷（スマホ→Wi-Fiプリンタ、年忌表手渡し） | 🟡 | `app/api/nenki/pdf/route.tsx`, `features/nenki/pdf/NoticeLetterPdf.tsx` | 案内状PDFはあるが「年忌表そのものを戒名順で並べCSV/印刷」帳票が無い | `findAnniversariesForYear`の結果を年忌表帳票化（B§年忌 P1） |

### §9 お墓・区画管理マップ — 視覚的区画 / 苗字逆引き

| せいざん細目 | 我々 | 該当ファイル | ギャップ | 対応方針 |
| :-- | :--: | :-- | :-- | :-- |
| 視覚的区画（図面再現・空き=グレー/使用=ブルー） | 🟡 | `features/kukaku/map/MapBoard.tsx`, `MapTile.tsx`, `map/grid.ts`, `app/(main)/kukaku/map/page.tsx` | 色分け・DnD配置・タイルクリック遷移は動く | 下記「図面再現」を補強 |
| **[追補] 図面再現（実レイアウトの背景画像敷設）** | 🟡 | `prisma/schema.prisma`(GravePlotArea:317行・背景画像列なし) | 背景図面画像の敷設が無く、実墓地レイアウトの忠実再現ができない | GravePlotAreaに背景画像URL列＋canvas背景敷設（B§区画 P2） |
| タイル情報密度（種別+番号+使用者姓） | 🟡 | `features/kukaku/map/MapTile.tsx`(plotNumberのみ表示) | 使用者姓はhover止まり、種別アイコン無し | タイル面に種別+番号+使用者姓表示（データ取得済・フロントのみ、安価） |
| 区画→カルテ逆引き | ✅ | `MapTile.tsx`, `app/(main)/kukaku/[id]/page.tsx` | 区画→施主カルテのワンクリック遷移は成立 | 維持 |
| 苗字逆引き（墓標名≠使用者でも特定） | ❌ | `lib/search/queries.ts`(GravePlot未対象) | 主機能が片方向のみ。墓標名/刻名カラム無し | GravePlotに墓標名/刻名追加＋横断検索統合（§1と同一打ち手、B§区画 P1） |
| 空き区画検索・新規割当 | ❌ | — | 種別/面積/状態での空き区画検索UI・割当導線無し | E09で空き区画検索＋割当（B§区画 P1） |
| 拡張ステータス（滞納/無縁化/合祀済/返還） | 🟡 | `prisma/schema.prisma`(GravePlotStatus:4値・343-348行) | AVAILABLE/RESERVED/IN_USE/CLOSEDのみ | enum拡張＋地図色分け（E09/E10） |

### §10 合祀予定管理・行事管理（シフト表）

| せいざん細目 | 我々 | 該当ファイル | ギャップ | 対応方針 |
| :-- | :--: | :-- | :-- | :-- |
| 合祀期限自動計算→対象者リストアップ | ❌ | `prisma/schema.prisma`(安置/合祀フィールド無し) | 安置期間・合祀移行予定日のモデル/ロジック皆無 | GraveContractの安置期間からlib/合祀期限を純関数算出→対象抽出（E10, B§合祀 P1） |
| 棚経等の訪問ルート/シフト自動リスト化 | ❌ | `prisma/schema.prisma`(MemorialService.assignedUserId:226行 未参照) | assignedUserId列はあるがコードから一切未使用 | E30: 月参り/棚経の対象登録・**訪問順リスト並べ替え**・実施自動履歴化（**地図への経路描画はしない＝P8回避／下記特許追補**）（B§棚経 P2） |
| **[追補] シフト表という成果物（担当者×日付の人員配置表）** | ❌ | — | 巡回順とは別に「シフト表/人員配置表」の帳票出力が無い | E30に内包。担当者×日付の一覧/印刷（B§棚経 P2） |
| 行事管理（寺全体の年中行事） | ❌ | `prisma/schema.prisma`(MemorialService.householdId NOT NULL・218行) | 世帯非依存の寺行事を登録不可 | householdId任意化 or `TempleEvent`新設（B§法要 P2） |

### §11 一括案内（法要のお知らせ）作成

| せいざん細目 | 我々 | 該当ファイル | ギャップ | 対応方針 |
| :-- | :--: | :-- | :-- | :-- |
| 条件抽出（特定期間に年忌を迎える家を一括抽出） | ✅ | `features/shipment/queries.ts`(listShipmentCandidatesForYear), `features/nenki/queries.ts` | findAnniversariesForYear起点・弔い上げ/離檀除外・世帯集約 | 維持。**抽出→人手確認→生成の手動トリガ維持（特許回避）** |
| 宛名・案内文の一括自動生成 | ✅ | `features/shipment/pdf/*`(AddressLabel/Envelope/MergedNoticeLetter), `app/api/shipment/*` | 宛名ラベル/封筒/案内状PDF＋宛名CSV。差込フォーム完備 | 維持 |
| 重複案内防止チェック | 🟡 | `features/shipment/actions.ts`, `prisma/schema.prisma`(ShipmentRecipient.summary:文字列・502-503行) | 同一世帯×同年の既送チェック無し。**突合キーが文字列summaryのみで機械判定が脆い（0.3）** | ShipmentRecipientに targetPersonId/anniversaryNo 列追加＋既送突合の警告UI（B§案内 P1） |
| 合祀案内状の差込自動生成 | 🟡 | `features/shipment/pdf/*`(年忌案内のみ) | 合祀予定の差込案内は合祀データ(E10)依存で未着手 | E10完成後に合祀案内テンプレ追加 |

### §12 分析・集計ダッシュボード — リスク可視化

| せいざん細目 | 我々 | 該当ファイル | ギャップ | 対応方針 |
| :-- | :--: | :-- | :-- | :-- |
| 会計クロス集計（科目×月×年計/CSV） | ✅ | `lib/kaikei/crosstab.ts`, `app/(main)/kaikei/shukei/page.tsx`, `features/kaikei/crosstab-export.ts` | 4月始まり・収入/支出/差引・セル→明細・BOM付CSV | 維持 |
| 管理志納金の予実/未収サマリ | 🟡 | `features/bochi/queries.ts`(aggregateDelinquencies), `features/gojikai/queries.ts` | 集計ロジックは存在するがダッシュボード未連携 | ダッシュボードに未収/集金進捗カード連携（B§分析 P0） |
| リスク可視化（抜け漏れ・檀家減少リスク） | 🟡 | `features/dashboard/queries.ts`, `app/(main)/dashboard/page.tsx` | 統計カードはあるがデータ品質KPI/グラフ無し | E11拡張: データ品質KPI＋グラフ（B§分析 P0/P2） |
| **[追補] 将来の檀家減少リスク（先細り予測）** | ❌ | — | 檀家数推移・年齢構成・離檀トレンドの予測が無い | 集計資産流用＋グラフ層（B§分析 P2、Z-3に内包）。**「更新順の行リスト」化はしない（特許回避）** |
| 経年トレンド/将来予測 | ❌ | — | 複数年比較・会費収入予測・グラフ描画コンポーネント無し | クロス集計資産流用＋グラフ層新設（B§分析 P2） |

### せいざんに無いが我々に存在する（優位点・棚卸し）

| 我々の独自/超え機能 | 該当ファイル |
| :-- | :-- |
| 没年精度4段階（FULL/YEAR_MONTH/YEAR/UNKNOWN）・明治以前対応 | `prisma/schema.prisma`(DateOfDeathPrecision:204-209行), `lib/kakochou/death-date.ts` |
| 中陰（忌日）自動計算・中陰表PDF | `lib/chuin/`, `features/chuin/pdf/ChuinTablePdf.tsx` |
| 塔婆の構造化（読上順/対象故人参照/読上帳PDF） | `prisma/schema.prisma`(Toba:255-272行), `features/toba/TobaManager.tsx`, `features/toba/pdf/TobaReadingListPdf.tsx` |
| 郵便振替 払込取扱票（科目連動オーバープリント） | `lib/postal-transfer/*`, `features/postal-transfer/PostalTransferGenerator.tsx` |
| CSV/Excel 双方向移行基盤（往復フィデリティ） | `lib/import/*`, `lib/export/*` |
| 過去帳の論理削除のみ・除外/復元・監査（deletedBy/Reason） | `prisma/schema.prisma`(DeathLedgerEntry.deletedAt/By/Reason:189-191行), `features/kakochou/SoftDeleteEntryButton.tsx`, `RestoreEntryButton.tsx` |

---

## B') せいざン12セクション 網羅性チェックリスト（漏れゼロの確認）

各セクションの主要訴求が本マトリクスに1行以上載っていることを確認した。

- §1 ✅ 完全クラウド/レスポンシブ/同時接続[+楽観ロック追補]・高速サジェスト・電話逆引き・苗字逆引き
- §2 ✅ 1ページ集約・年忌自動計算[+カウントダウン追補]・家メモ・多階層連絡先・関連する家
- §3 ✅ 会費一元管理・墓地管理料・契約プラン可視化・過去帳連携(区画→故人/[+カルテ→故人追補])
- §4 ✅ 法要葬儀記録・交流履歴・カスタムラベル[+絞り込み追補]・同一タイムライン
- §5 ✅ 書類写真クラウド保管[+紐付け先追補]・伝言板
- §6 ✅ 予定→カレンダー反映・カルテリンクURL・月ビュー・双方向[+refresh_token保全追補]・終了時刻
- §7 ✅ 下部アクションバー・音声入力・シンプル登録ウィザード
- §8 ✅ 過去帳横断一覧・柔軟な並び替え(戒名順)・CSV[+外注様式追補]・ダイレクト印刷
- §9 ✅ 視覚的区画[+図面再現追補]・タイル情報密度・区画→カルテ・苗字逆引き・空き区画検索・拡張ステータス
- §10 ✅ 合祀期限自動計算・棚経巡回[+シフト表追補]・行事管理
- §11 ✅ 条件抽出・宛名/案内自動生成・重複案内防止・合祀案内
- §12 ✅ 会計クロス集計・管理志納金サマリ・リスク可視化[+檀家減少予測追補]・経年トレンド

**結論: せいざん12セクションの訴求機能に取りこぼしなし**（0.2の8細目を追補して網羅完了）。
