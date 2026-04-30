import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * デフォルトではユニットテスト (純粋ロジック) のみ実行する。
 * 実 DB に接続する統合テスト (*.integration.test.ts) は明示的に
 * `pnpm test:integration` で実行する想定。
 */
export default defineConfig({
  test: {
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/*.integration.test.ts'],
    environment: 'node',
    globals: false,
    // 統合テストは別 config で長めの timeout にする
    testTimeout: 10_000,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
