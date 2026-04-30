---
description: マルチテナント境界の静的検査を実行し、違反があれば修正方針を提示する
allowed-tools: Bash(bash scripts/tenant-check.sh), Bash(scripts/tenant-check.sh), Read, Grep, Glob
---

# /tenant-check

寺務台帳のマルチテナント境界を監査します。`CLAUDE.md §4.1 / §7` で定めた以下の違反を機械的にスキャンします。

1. Server Action 内の `prisma.*` 呼び出しが `withTenant()` で包まれていないケース
2. `adminPrisma` (RLS bypass) が許可リスト外で使われているケース
3. Prisma スキーマで `tenantId` または `@@index([tenantId])` が欠けているモデル

## 実行結果

!`bash scripts/tenant-check.sh`

## 指示

上記スクリプトの出力を確認してください。

- **違反 0 件** の場合 → 「✅ 問題なし」とだけ簡潔に報告してください。追加の調査は不要です。
- **違反あり** の場合 → それぞれの違反について以下を行ってください:
  1. **該当ファイルを Read ツールで実際に読んで** 周辺コードを確認する
  2. 違反が発生している **具体的な行** を示す (`path:line`)
  3. **どう直せばよいか** をコード片で提示する (例: `withTenant(tenantId, async (tx) => { ... })` で包む、`requireCurrentTenantId()` で ID 取得、など)
  4. 例外的に許可すべき正当な理由があるなら、`scripts/tenant-check.sh` の `allowed_files` に追加する提案を併せて出す

修正提案は **ファイル単位でまとめて** 出し、ユーザーに「この方針で直してよいか」を確認してから実装に進んでください。
