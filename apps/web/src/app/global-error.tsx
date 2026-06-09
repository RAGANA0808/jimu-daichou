'use client';

/**
 * ルートレベルのエラー境界 (App Router global-error.tsx)。
 * ルートレイアウトごと置き換わるため、自前で <html>/<body> を描画する。
 * 個人情報の流出を避け、画面には定型メッセージと参照番号のみ表示する。
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ja">
      <body
        style={{
          fontFamily: 'sans-serif',
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#fdfaf4',
          color: '#241f1a',
        }}
      >
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>
            申し訳ございません。問題が発生いたしました。
          </h1>
          <p style={{ marginTop: '0.5rem', color: '#6b5f50' }}>
            お手数ですが、もう一度お試しください。続く場合は管理者へご連絡ください。
          </p>
          {error.digest && (
            <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#6b5f50' }}>
              参照番号: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: '1.25rem',
              padding: '0.5rem 1.25rem',
              borderRadius: '0.375rem',
              border: 'none',
              background: '#c2410c',
              color: '#ffffff',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            もう一度試す
          </button>
        </div>
      </body>
    </html>
  );
}
