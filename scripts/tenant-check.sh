#!/usr/bin/env bash
# 寺務台帳 マルチテナント境界の静的検査
#
# CLAUDE.md §4.1 / §7 で禁止している以下を grep で機械的にスキャンする:
#   1. Server Action 内で prisma を呼ぶのに withTenant() を通していないケース
#   2. adminPrisma (RLS bypass) を許可リスト外から呼んでいるケース
#   3. Prisma スキーマで tenantId / @@index([tenantId]) が欠けているモデル
#
# 違反があれば非 0 終了。CI や pre-commit にも差し込める。

set -euo pipefail

cd "$(dirname "$0")/.."

VIOLATIONS=0
CHECKED=0

section() {
  echo
  echo "=== $1 ==="
}

# ---------------------------------------------------
# 1. Server Action (`'use server'` 付きファイル) の withTenant カバレッジ
# ---------------------------------------------------
section "1. Server Actions の withTenant カバレッジ"

sa_files=$(grep -lE "^['\"]use server['\"]" -r apps/web/src --include="*.ts" --include="*.tsx" 2>/dev/null || true)

if [ -z "$sa_files" ]; then
  echo "  (Server Action ファイルは見つかりませんでした)"
else
  while IFS= read -r file; do
    [ -z "$file" ] && continue
    case "$file" in
      *.test.ts|*.test.tsx|*.integration.test.ts) continue ;;
    esac
    CHECKED=$((CHECKED + 1))

    # prisma を呼んでいるか? (adminPrisma は別のチェックで扱う)
    if grep -qE '(^|[^[:alnum:]_])prisma\.' "$file" 2>/dev/null; then
      if ! grep -qE 'withTenant\(' "$file" 2>/dev/null; then
        echo "  ❌ $file"
        echo "     Prisma を呼んでいるが withTenant() を使っていない"
        VIOLATIONS=$((VIOLATIONS + 1))
      fi
    fi
  done <<< "$sa_files"

  if [ "$CHECKED" -gt 0 ]; then
    echo "  (検査対象: $CHECKED ファイル)"
  fi
fi

# ---------------------------------------------------
# 2. adminPrisma の使用箇所チェック
# ---------------------------------------------------
section "2. adminPrisma の使用箇所 (許可リスト外は違反)"

allowed_files=(
  "apps/web/src/lib/db/admin-client.ts"
  "apps/web/src/lib/db/index.ts"
  "apps/web/src/lib/auth/session.ts"
  "apps/web/src/app/api/auth/callback/route.ts"
)

admin_uses=$(grep -rlE 'adminPrisma' apps/web/src --include="*.ts" --include="*.tsx" 2>/dev/null || true)

unauthorized=0
if [ -n "$admin_uses" ]; then
  while IFS= read -r file; do
    [ -z "$file" ] && continue
    # 統合テストは許可
    case "$file" in
      *.integration.test.ts|*.integration.test.tsx) continue ;;
    esac

    # 正規化 (Git Bash で \ が混じる可能性への保険)
    normalized="${file//\\//}"

    is_allowed=0
    for allowed in "${allowed_files[@]}"; do
      if [ "$normalized" = "$allowed" ]; then
        is_allowed=1
        break
      fi
    done

    if [ "$is_allowed" -eq 0 ]; then
      echo "  ❌ $file"
      echo "     adminPrisma は認証ブートストラップ専用 (RLS bypass)。ここでは prisma + withTenant を使うこと"
      VIOLATIONS=$((VIOLATIONS + 1))
      unauthorized=$((unauthorized + 1))
    fi
  done <<< "$admin_uses"
fi

if [ "$unauthorized" -eq 0 ]; then
  echo "  ✅ 許可リスト内のみで使われています"
fi

# ---------------------------------------------------
# 3. Prisma スキーマの tenantId 必須チェック
# ---------------------------------------------------
section "3. Prisma スキーマ (model の tenantId 必須 + @@index)"

schema_file="prisma/schema.prisma"
if [ ! -f "$schema_file" ]; then
  echo "  (スキーマファイルが見つからない: $schema_file)"
else
  models=$(awk '/^model +/ { print $2 }' "$schema_file")

  schema_violations=0
  while IFS= read -r model; do
    [ -z "$model" ] && continue
    [ "$model" = "Tenant" ] && continue

    block=$(awk -v m="$model" '
      $1 == "model" && $2 == m { in_block=1 }
      in_block { print }
      in_block && /^}/ { in_block=0; exit }
    ' "$schema_file")

    if ! echo "$block" | grep -qE '^[[:space:]]+tenantId[[:space:]]+String[[:space:]]+@db\.Uuid'; then
      echo "  ❌ model $model: tenantId String @db.Uuid が欠けている"
      VIOLATIONS=$((VIOLATIONS + 1))
      schema_violations=$((schema_violations + 1))
    fi

    if ! echo "$block" | grep -qE '@@index\(\[tenantId\]\)'; then
      echo "  ❌ model $model: @@index([tenantId]) が欠けている"
      VIOLATIONS=$((VIOLATIONS + 1))
      schema_violations=$((schema_violations + 1))
    fi
  done <<< "$models"

  if [ "$schema_violations" -eq 0 ]; then
    echo "  ✅ すべてのモデルで tenantId と @@index が揃っています"
  fi
fi

# ---------------------------------------------------
# サマリ
# ---------------------------------------------------
echo
echo "=== サマリ ==="
if [ "$VIOLATIONS" -eq 0 ]; then
  echo "✅ テナント境界違反なし"
  exit 0
else
  echo "❌ 違反合計: $VIOLATIONS 件"
  exit 1
fi
