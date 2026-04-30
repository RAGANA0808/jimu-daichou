import 'server-only';
import path from 'node:path';
import { Font } from '@react-pdf/renderer';

/**
 * 案内状 PDF で使う日本語フォント。
 *
 * `@fontsource/noto-sans-jp` が提供する woff (日本語サブセット, 400 weight) を
 * node_modules から直接参照する。@react-pdf/renderer v4 は fontkit 経由で
 * woff を読めるため追加のダウンロードは不要。
 *
 * Next.js Route Handler は apps/web を cwd として起動されるため、
 * `node_modules/...` の相対パスで解決できる。
 */
export const PDF_FONT_FAMILY = 'NotoSansJP';

let registered = false;

export function ensurePdfFontRegistered(): void {
  if (registered) return;

  const fontPath = path.join(
    process.cwd(),
    'node_modules',
    '@fontsource',
    'noto-sans-jp',
    'files',
    'noto-sans-jp-japanese-400-normal.woff',
  );

  Font.register({
    family: PDF_FONT_FAMILY,
    src: fontPath,
  });

  // 日本語テキストの自動ワードブレーク (ひらがな/漢字の途中で改行しないため)
  Font.registerHyphenationCallback((word) => [word]);

  registered = true;
}
