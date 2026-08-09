# Knowledge Dashboard

Google ドライブに蓄積してきたナレッジ用スプレッドシートの一覧と、複数リポジトリ（kizashi・supermarket-price-tracker・gemini-monitor 等）の実装ナレッジ・要件知見を横断集約したダッシュボード。

## Google Drive アクセスについて

Claude は Google Drive コネクタ経由でこのアカウント (`gurii.gabreh.0516@gmail.com`) のドライブに直接アクセスできる。
検索・メタデータ取得・内容の読み取りが可能なため、「Google Drive にアクセスできれば、そこに保存されたスプレッドシートにもアクセスできる」という認識は正しい。
このダッシュボードの `data/spreadsheets.json` も、その Drive アクセスでスプレッドシート一覧を検索・整理して生成した。

## 構成

- `dashboard.html` — 単一の静的ページ。上部のタブで「スプレッドシート一覧」と「実装ナレッジ」を切り替えられる。
  - スプレッドシート一覧: 検索・カテゴリ絞り込み・並び替え・フォルダ単位の折りたたみに対応。データは埋め込み済み（外部依存なし）。
  - 実装ナレッジ: `data/knowledge-index.json` を実行時に fetch して表示。検索・リポジトリ/種別での絞り込みに対応。
- `data/spreadsheets.json` — スプレッドシート一覧の元データ（id・タイトル・カテゴリ・URL・所有者・更新日時）。ダッシュボードを再生成する際のソース。
- `data/knowledge-index.json` — [gurii-gabreh/progress-tracker-dashboard](https://github.com/gurii-gabreh/progress-tracker-dashboard) の `data/tasks.json`（各タスクの `detail`/`issues`）・`data/requirements.json`（新規リポジトリ要件定義・ユーザー思考パターン）を横断集約したナレッジインデックス。人が閲覧するだけでなく、他の Claude Code セッションが
  `https://raw.githubusercontent.com/gurii-gabreh/Knowledge-Dashboard/main/data/knowledge-index.json` を直接 fetch して過去の実装知見を参照する用途も想定している。
- `scripts/generate-knowledge-index.js` — `data/knowledge-index.json` を再生成する Node スクリプト。tasks.json/requirements.json は public リポジトリの raw content なので認証不要。内容（items/knownRepos）に変化が無ければ `generatedAt` を据え置き、無意味な差分コミットを避ける。
- `.github/workflows/update-knowledge-index.yml` — 上記スクリプトを毎日自動実行し、変更があれば `data/knowledge-index.json` をコミット・push する GitHub Actions ワークフロー（`workflow_dispatch` で手動実行も可能）。

## 一覧の更新方法

### スプレッドシート一覧（`data/spreadsheets.json`）

Drive 上のスプレッドシートは増減するため、一覧は都度作り直す必要がある（Google Drive 検索は認証が絡むため GitHub Actions での自動化はしていない）。更新する場合は Claude に依頼して:

1. Google Drive コネクタで `mimeType = 'application/vnd.google-apps.spreadsheet'` を検索
2. `data/spreadsheets.json` を最新の内容で作り直す
3. `dashboard.html` 内に埋め込んでいる同じ内容（`DATA` 定数）も同期する

を行えばよい。定期的に自動更新したい場合は、既存の `progress-tracker-dashboard` プロジェクトと同様に Routine（自己バインドセッション）を組む方式が使える。

### 実装ナレッジ（`data/knowledge-index.json`）

`.github/workflows/update-knowledge-index.yml` により毎日自動更新される（手動で再生成したい場合は `node scripts/generate-knowledge-index.js` を実行してコミットすればよい）。
