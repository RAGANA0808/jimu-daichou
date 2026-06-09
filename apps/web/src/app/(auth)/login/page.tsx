import { LoginForm } from './LoginForm';

const ERROR_MESSAGES: Record<string, string> = {
  invalid_code: 'ログインリンクが不正です。もう一度お試しください。',
  exchange_failed:
    'ログイン処理に失敗しました。リンクの有効期限が切れている可能性があります。',
  session_lost:
    'セッションが取得できませんでした。お手数ですが再度ログインしてください。',
  not_provisioned:
    'このメールアドレスは寺務台帳に登録されていません。管理者にお問い合わせください。',
  binding_conflict:
    'アカウントの紐付けに食い違いが発生しています。管理者にお問い合わせください。',
  deactivated:
    'このアカウントは無効化されています。寺院の管理者 (住職) にお問い合わせください。',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorMessage = error ? (ERROR_MESSAGES[error] ?? null) : null;

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-muted">
      <div className="w-full max-w-md rounded-lg border border-border bg-surface p-8 shadow-sm">
        <div className="mb-6 space-y-2 text-center">
          <h1 className="text-2xl font-rounded tracking-wider">寺務台帳</h1>
          <p className="text-sm text-muted-foreground">
            登録されているメールアドレスをご入力ください。
            <br />
            ログイン用のリンクをお送りします。
          </p>
        </div>

        {errorMessage && (
          <p
            role="alert"
            className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            {errorMessage}
          </p>
        )}

        <LoginForm />
      </div>
    </main>
  );
}
