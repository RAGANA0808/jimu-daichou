-- GravePlotStatus enum を拡張する (G-6 地図色分け: 滞納/無縁化/合祀済)。
-- 既存値 (AVAILABLE / IN_USE / RESERVED / CLOSED) は維持し、3 値を追加する。
-- ALTER TYPE ... ADD VALUE はトランザクション内で「追加した値の即時利用」ができないため、
-- enum 拡張のみを行う単独マイグレーションに分離している (本マイグレでは新値を参照しない)。
-- IF NOT EXISTS により再適用しても安全。
ALTER TYPE "GravePlotStatus" ADD VALUE IF NOT EXISTS 'OVERDUE';
ALTER TYPE "GravePlotStatus" ADD VALUE IF NOT EXISTS 'UNCLAIMED';
ALTER TYPE "GravePlotStatus" ADD VALUE IF NOT EXISTS 'INTERRED_TOGETHER';
