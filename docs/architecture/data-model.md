# データモデル

## 概要

寺務台帳のデータモデルは「世帯 (Household)」を中心に、故人 (過去帳)・法要・墓・会計が関連する構造。すべてのテーブルに `tenantId` を持ち、マルチテナント境界を形成する。

## ER 概念図

```
Tenant (寺院)
  └─ User (寺族)
  └─ Household (世帯)                 ← 施主中心の家族単位
       ├─ Person (家族構成員)          ← 存命者・故人とも
       │    └─ DeathLedgerEntry (過去帳) ← Person が故人の場合
       │         └─ AnniversaryMemorialService (年忌法要)
       ├─ GravePlot (区画)             ← 複数世帯が同じ区画でもよい
       ├─ MemorialService (法要)       ← 世帯が主催
       ├─ InteractionNote (伝言メモ)
       ├─ Document (書類・写真)
       └─ Transaction (入出金)          ← 護持会費・お布施・寄付等
```

## 主要エンティティ

### Tenant
1 つの寺院。システム全体で最初に作成される。

### User
寺院の利用者（住職・寺族・事務員）。1 User は 1 Tenant に所属 (Phase1)。

### Household (世帯 / 檀信徒カルテ)
檀信徒管理の中心。施主情報・住所・連絡先・護持会費納入状況。

### Person (家族構成員)
世帯に属する個人。存命 / 故人のフラグあり。故人化すると `DeathLedgerEntry` が作成される。

### DeathLedgerEntry (過去帳)
故人 1 名分の記録。戒名・俗名・没年月日（和暦・西暦）・行年・続柄・埋葬場所。
**論理削除のみ。物理削除禁止**。

### MemorialService (法要)
世帯主催の法要。日時・場所・対象故人・参拝人数・塔婆・御布施・担当寺族・準備状況。

### GravePlot (お墓・区画)
区画番号・タイプ・使用状況・契約日・契約プラン・納骨故人。

### Transaction (会計)
入出金 1 件。費目・金額・支払日・支払方法・支払者（世帯）。

### InteractionNote (伝言メモ)
世帯との会話・訪問記録。時系列で蓄積。

### Document
契約書・過去帳写真など。Supabase Storage のオブジェクト参照。

---

## 詳細なフィールドは `prisma/schema.prisma` を参照。
