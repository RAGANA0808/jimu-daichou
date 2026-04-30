import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * 統合テスト用。実 Supabase DB へ接続する (.env の DATABASE_URL を使用)。
 * 並列実行すると RLS セッション変数やトランザクションが干渉するため、
 * fileParallelism=false + maxWorkers=1 で順次実行する。
 */
export default defineConfig({
  test: {
    include: ['src/**/*.integration.test.{ts,tsx}'],
    exclude: ['**/node_modules/**'],
    environment: 'node',
    globals: false,
    testTimeout: 30_000,
    pool: 'forks',
    fileParallelism: false,
    maxWorkers: 1,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
