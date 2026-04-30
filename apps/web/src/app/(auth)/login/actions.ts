'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';

function requireAppUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url) {
    throw new Error('NEXT_PUBLIC_APP_URL が未設定です。');
  }
  return url.replace(/\/$/, '');
}

/**
 * Magic Link (メール OTP) でのログイン要求。
 * 現時点は Magic Link のみ。将来 Google OAuth を有効化した場合は
 * 別途 `signInWithGoogleAction` を追加する想定 (Supabase Dashboard 側で Provider 有効化後)。
 */
export async function sendMagicLinkAction(
  _prevState: unknown,
  formData: FormData,
): Promise<{ status: 'idle' | 'sent' | 'error'; message: string }> {
  const emailRaw = formData.get('email');
  if (typeof emailRaw !== 'string' || emailRaw.trim().length === 0) {
    return { status: 'error', message: 'メールアドレスを入力してください。' };
  }
  const email = emailRaw.trim().toLowerCase();

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${requireAppUrl()}/api/auth/callback`,
      shouldCreateUser: false,
    },
  });

  if (error) {
    return {
      status: 'error',
      message: `送信に失敗しました: ${error.message}`,
    };
  }

  return {
    status: 'sent',
    message:
      'ログイン用のリンクをメールでお送りしました。メールをご確認ください。',
  };
}

