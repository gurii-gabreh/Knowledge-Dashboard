# Knowledge-Dashboard

複数リポジトリ横断のGoogle Driveスプレッドシート一覧・実装ナレッジ集約ビュー。GitHub Pagesで公開(`.github/workflows/deploy-pages.yml`、mainへのpushで自動デプロイ)。

**既知の注意点(2026-08-13時点)**: このリポジトリのGitHub上の「デフォルトブランチ」設定が、2026-08-01時点の古いブランチ`claude/spreadsheet-list-dashboard-te7yvs`のままになっている(KND-007/KND-008参照)。ブランチ指定なしでこのリポジトリのファイルを取得すると古い内容を掴む可能性があるため、**必ず`main`ブランチを明示指定すること**。

<!-- CORE-RULES:START (auto-synced from progress-tracker-dashboard/data/claude-core-rules.md -- do not edit by hand, edit the source instead) -->
## 最重要ルール(このファイルに直接記載。fetch不要で必ず読める)

- このリポジトリは `gurii-gabreh/progress-tracker-dashboard` が進捗・実装ナレッジを一元管理する対象の1つ
- **manager-room(状況把握・優先度判断・振り分けのみ)とworker-room(実装担当)の役割分担がある。このセッションで実装作業をしているなら、それはworker-room役**
- 実装したタスクの`detail`(実装ナレッジ)・`note`・`checkHistory`を、progress-tracker-dashboardの`data/tasks.json`側で空欄のまま完了させない
- 意味のある実装判断(設計パターン・DB設計・セキュリティ対応・AI/LLM関連・テスト方針など)があれば、progress-tracker-dashboardの`data/concept-log.json`にも記録する

## より詳しいルール(下記URLを実際にWebFetch等で取得すること。リンクを貼るだけでは中身は読み込まれない)

- https://raw.githubusercontent.com/gurii-gabreh/progress-tracker-dashboard/main/README.md
- https://raw.githubusercontent.com/gurii-gabreh/progress-tracker-dashboard/main/data/policy.json
- https://raw.githubusercontent.com/gurii-gabreh/progress-tracker-dashboard/main/data/ai-config.json
<!-- CORE-RULES:END -->

上記ブロックは`gurii-gabreh/progress-tracker-dashboard`の`data/claude-core-rules.md`が正本で、GitHub Actionsが自動同期する。直接編集しても次回同期で上書きされる。
