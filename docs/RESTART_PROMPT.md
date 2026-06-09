# 新セッション再開用プロンプト（コピペ用）

新しいセッションを開いたら、以下をそのまま最初のメッセージに貼ってください。

---

```
寺務台帳 SaaS（C:\Users\reon\開発\寺務Harness）の開発を続けます。ultracode で進めてください。

まず docs/HANDOFF.md を読んで現在地・既知の問題・残ロードマップ・規約を把握してください。
（補助資料: docs/requirements/seizan-coverage-matrix.md = せいざん12セクション網羅状況、
 docs/requirements/ui-ux-redesign-v2.md = ロードマップ根拠）

【前提の確認事項】
- 接続プール枯渇（EMAXCONNSESSION）は Supabase Pro 化で後回しと決定済み。今は触らなくてよい。
- これまで機能テスト（画面遷移の実機確認）をしておらず、検索→詳細遷移でバグが出た。
  今後のウェーブは Playwright / chrome-devtools MCP で主要導線を click-through 検証してから完了報告すること。
  （ログイン後画面はマジックリンク認証が要るので、自動ログインの可否は最初に私に確認して）

【今回やってほしいこと】
次のウェーブ「PAPERLESS-MOBILE」を Dynamic Workflow で実装してください。
（§5 書類クラウド保管 = Document に紐付け先列追加＋Supabase Storage連携＋添付UI＋論理削除方針 /
  §7 音声入力 = Web Speech API マイクボタン / シンプル登録ウィザード）
Supabase Storage のバケット設定が必要なら、まず手順を提示して。

設計（並列）→実装（直列）→検証 のフェーズ構成で、typecheck/test/tenant-check を緑に保ち、
マイグレーションは非対話（手書きSQL＋RLS policy → db:migrate deploy → db:generate）で。
完了したら実機 click-through 検証まで実施し、worklog（docs/worklog/）に記録してください。
```

---

## 別の入り口（PAPERLESS 以外をやりたい場合）

上の【今回やってほしいこと】の段落だけ、以下のどれかに差し替えてください。

- **接続バグを根治したい**:
  「檀信徒詳細ページ `app/(main)/danshintoto/[id]/page.tsx` の ~14 並列 withTenant クエリを
  1つの withTenant 内に集約して、コネクション占有を1本化してください（問題A 選択肢3）。」

- **次の機能ウェーブ（通知・巡回）**:
  「ウェーブ OUTREACH-NOTIFY を実装してください（通知・一斉連絡 / 棚経・月参り巡回=順序リストのみ /
  シフト表帳票 / 宗派プリセット）。地図への経路描画はしない（YMFG特許回避）。」

- **分析ダッシュボード**:
  「ウェーブ ANALYTICS-LATER を実装してください（経年トレンド・檀家減少リスク予測のグラフ層）。
  『更新順の行リスト』をダッシュボード主構成にしない（せいざん特許回避）。」

- **安価なUI改善をまとめて**:
  「年忌バッジに『次回まであと◯年』表示 / 区画タイルに種別+番号+使用者姓 /
  一覧の戒名順ソート・並べ替え導線 をまとめて入れてください。」
</content>
