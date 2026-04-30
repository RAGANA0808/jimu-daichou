import { PrismaClient, UserRole } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

const PLACEHOLDER_SLUG = "my-temple";

// シードは RLS (jimu_app) を bypass できる必要があるため、DIRECT_URL (postgres) で接続する。
// アプリ本体は DATABASE_URL (jimu_app, NOBYPASSRLS) を使う。
const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL },
  },
});

async function upsertInitialTenant() {
  const tenantName = process.env.INITIAL_TENANT_NAME ?? "自寺";
  const tenantSlug = process.env.INITIAL_TENANT_SLUG ?? PLACEHOLDER_SLUG;

  if (tenantSlug !== PLACEHOLDER_SLUG) {
    const placeholder = await prisma.tenant.findUnique({
      where: { slug: PLACEHOLDER_SLUG },
    });
    if (placeholder) {
      const renamed = await prisma.tenant.update({
        where: { slug: PLACEHOLDER_SLUG },
        data: { name: tenantName, slug: tenantSlug },
      });
      console.log(
        `プレースホルダーから改名しました: ${renamed.name} (slug=${renamed.slug})`,
      );
      return renamed;
    }
  }

  const tenant = await prisma.tenant.upsert({
    where: { slug: tenantSlug },
    update: { name: tenantName },
    create: { name: tenantName, slug: tenantSlug },
  });
  console.log(`テナントを用意しました: ${tenant.name} (id=${tenant.id})`);
  return tenant;
}

/**
 * 初期管理ユーザーを Supabase Auth と自前 User テーブルの両方に用意する。
 * INITIAL_ADMIN_EMAIL が未設定ならスキップ。
 *
 * Supabase Auth 側: service_role キーで admin API を使い auth.users にレコードを作る。
 *   email_confirm=true で登録するので、初回からメール認証済み扱い = Magic Link が即届く。
 * 自前 User 側: 住職 (HEAD_PRIEST) ロールで upsert。supabaseUserId も同時にバインドする。
 */
async function upsertInitialAdminUser(tenantId: string) {
  const adminEmailRaw = process.env.INITIAL_ADMIN_EMAIL;
  if (!adminEmailRaw || adminEmailRaw.trim().length === 0) {
    console.log(
      "INITIAL_ADMIN_EMAIL が未設定のため、初期管理ユーザーのプロビジョニングをスキップします。",
    );
    return;
  }
  const adminEmail = adminEmailRaw.trim().toLowerCase();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.warn(
      "NEXT_PUBLIC_SUPABASE_URL または SUPABASE_SERVICE_ROLE_KEY が未設定のため、Supabase Auth への登録をスキップします。",
    );
    return;
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(
    `Supabase admin API 接続先: ${supabaseUrl} (service_role プレフィックス: ${serviceRoleKey.slice(0, 10)}…)`,
  );

  // 既存の auth.users を email で検索する (listUsers はページネーションあり、
  // Phase 1 は少人数なので 1 ページ目のみで十分)。
  const existing = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (existing.error) {
    throw new Error(
      `Supabase auth.users の一覧取得に失敗: ${existing.error.message}`,
    );
  }
  const found = existing.data.users.find(
    (u) => u.email?.toLowerCase() === adminEmail,
  );

  let supabaseUserId: string;
  if (found) {
    supabaseUserId = found.id;
    console.log(
      `Supabase auth.users に既存のユーザーを検出しました (id=${supabaseUserId})`,
    );
  } else {
    const created = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      email_confirm: true,
    });
    if (created.error || !created.data.user) {
      throw new Error(
        `Supabase auth.users への作成に失敗: ${created.error?.message}`,
      );
    }
    supabaseUserId = created.data.user.id;
    console.log(
      `Supabase auth.users にユーザーを作成しました (id=${supabaseUserId})`,
    );
  }

  const displayNameGuess = adminEmail.split("@")[0] ?? "住職";

  const user = await prisma.user.upsert({
    where: { tenantId_email: { tenantId, email: adminEmail } },
    update: { supabaseUserId },
    create: {
      tenantId,
      email: adminEmail,
      displayName: displayNameGuess,
      role: UserRole.HEAD_PRIEST,
      supabaseUserId,
    },
  });
  console.log(
    `初期管理ユーザーを用意しました: ${user.email} (role=${user.role})`,
  );
}

async function main() {
  const tenant = await upsertInitialTenant();
  await upsertInitialAdminUser(tenant.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
