# 寺務台帳 (Jimu-Daichou)

お寺と檀信徒の関係を **100 年先まで** つなぐための SaaS。単なる檀家管理ソフトではなく「檀信徒カルテ」として、寺院と檀信徒の関係性を深化させ、持続可能な寺院運営を支援します。

## 目指す姿

1. **「記憶」を「記録」に変え、信頼を未来へつなぐ** — 属人的な記憶を組織の共有資産に
2. **「事務」を効率化し、「法務と対話」に専念できる** — 年忌表・宛名書き等の自動化
3. **「すぐ見つかり、気づき、思いやる」伴走型運営** — 電話対応時に即座にカルテを参照

## 主要機能

- 檀信徒カルテ（世帯・家族・過去の履歴の統合管理）
- 過去帳（戒名・俗名・没年月日・年忌の管理）
- 法要・行事管理（Google カレンダー連携）
- お墓・区画管理
- 会計（護持会費・お布施・収支）
- 書類・帳票自動生成（年忌表・案内状・宛名ラベル）

## 技術スタック

- Next.js 15 (App Router) + TypeScript
- PostgreSQL + Prisma (マルチテナント: tenant_id + RLS)
- Supabase (Auth / Storage) → Phase3 で AWS/GCP 移行想定
- Google Calendar API
- モノレポ: pnpm workspaces + Turborepo

詳細は [CLAUDE.md](./CLAUDE.md) と [docs/adr/0001-tech-stack.md](./docs/adr/0001-tech-stack.md) を参照。

## セットアップ

```bash
pnpm install
cp .env.example .env          # 値を埋める
pnpm db:migrate
pnpm db:seed
pnpm dev                      # http://localhost:3104
```

## ドキュメント

- 要件定義: [docs/requirements/寺務台帳_機能要件定義書.md](./docs/requirements/寺務台帳_機能要件定義書.md)
- ドメイン用語: [docs/domain/ubiquitous-language.md](./docs/domain/ubiquitous-language.md)
- アーキテクチャ: [docs/architecture/overview.md](./docs/architecture/overview.md)
- 開発ガイドライン: [CLAUDE.md](./CLAUDE.md)
