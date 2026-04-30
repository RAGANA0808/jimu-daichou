import { redirect } from 'next/navigation';

// ルートは常にダッシュボードへ。未ログインなら middleware が /login へリダイレクトする。
export default function Home() {
  redirect('/dashboard');
}
