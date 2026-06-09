/**
 * 「本文へスキップ」リンク (E13 アクセシビリティ)。
 * 通常は視覚的に隠し、フォーカス時のみ橙下地・白文字 (AA) で出現する。
 * 対応する本文側に id="main-content" tabindex="-1" を付けて使う。
 */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-[70] focus:rounded-md focus:bg-brand focus:px-4 focus:py-2 focus:text-base focus:font-semibold focus:text-brand-foreground focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2"
    >
      本文へスキップ
    </a>
  );
}
