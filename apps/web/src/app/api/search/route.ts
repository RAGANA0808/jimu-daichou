import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { search } from '@/lib/search';

// Prisma ($queryRaw) は Node ランタイム必須。
export const runtime = 'nodejs';
// 検索結果は都度動的に評価する (キャッシュしない)。
export const dynamic = 'force-dynamic';

/**
 * 横断あいまい検索のインクリメンタル取得 API (E01)。
 *
 * クエリ `q` を受け取り、世帯 (名前かな・電話) と過去帳 (戒名・俗名) を横断検索する。
 * 検索ロジックは withTenant でテナント分離される。未ログインは 401。
 * 個人情報をログに出さないため、エラー時もクエリ内容や結果は記録しない。
 */
export async function GET(request: NextRequest): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get('q') ?? '';
  if (q.trim().length === 0) {
    return NextResponse.json({
      households: [],
      deathLedgerEntries: [],
      gravePlots: [],
      noteHits: [],
    });
  }

  const results = await search(q);
  return NextResponse.json(results);
}
