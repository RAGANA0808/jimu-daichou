import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Next 15.5 で experimental から昇格。型付きルートを引き続き有効化。
  typedRoutes: true,
  // モノレポ root を明示 (ホームの stray lockfile を root と誤検出する警告を抑止)。
  outputFileTracingRoot: path.join(process.cwd(), "..", ".."),
};

export default nextConfig;
