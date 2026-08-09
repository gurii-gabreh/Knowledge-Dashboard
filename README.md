# Knowledge Dashboard

このリポジトリには2つの独立したダッシュボードがある。

1. **`index.html`** — 実装知見インデックス(このセクションで説明)。GitHub Pages 公開・自動更新。
2. **`dashboard.html`** — Google Drive 上のスプレッドシート一覧(次のセクションで説明)。手動更新。

---

## `index.html` — 実装知見インデックス

`progress-tracker-dashboard` リポジトリの `data/tasks.json` を正本として、各プロジェクト(kizashi・supermarket-price-tracker・gemini-monitor・progress-tracker-dashboard・ai-research-radar・usage-tracker 等)の実装ナレッジ(`detail` / `issues` / `manualSetup` / `note` / `output` など)を横断的に集約し、(1) 人が検索・閲覧できるダッシュボードと、(2) 他の Claude Code セッションが着手前に参考値として機械的に取得できる JSON の両方を提供する。

**書き込みは一切行わない、プル型の集約・表示専用**のアーキテクチャ。`progress-tracker-dashboard` 側のタスク運用(GAS 連携・自動実装 Routine 等)には一切干渉しない。

### 構成

- `scripts/build-index.js` — `progress-tracker-dashboard` の `data/tasks.json`(raw URL: https://raw.githubusercontent.com/gurii-gabreh/progress-tracker-dashboard/main/data/tasks.json )を取得し、`tasks` と `subtasks` を再帰的に平坦化して `data/knowledge-index.json` を生成する Node.js スクリプト(依存パッケージ無し、Node 組み込みの `fetch` のみ使用)。
- `.github/workflows/build-index.yml` — 上記スクリプトを push トリガー・1日1回のスケジュール(03:00 JST)・手動実行(`workflow_dispatch`)で実行し、差分があれば `data/knowledge-index.json` をコミット・push する GitHub Actions ワークフロー。
- `data/knowledge-index.json` — 生成されたインデックス本体。各エントリは `repo, task, status, priority, category, updated, detail, issues, manualSetup, note, output, parentTask, isSubtask, spreadsheetUrls` を持つ。
- `index.html` — `data/knowledge-index.json` を fetch して表示する静的ページ(GitHub Pages で公開)。キーワード検索・リポジトリ / ステータス絞り込み・並び替えに対応し、各カードから関連する Google スプレッドシートへ直接リンクできる。

### スプレッドシートリンクの検出ルール(`spreadsheetUrls`)

`detail` / `output` / `manualSetup` / `note` の文字列内から以下を検出する。

1. 完全な URL(`https://docs.google.com/spreadsheets/d/...`)はそのまま採用する。
2. `SPREADSHEET_ID: <ID>` のように ID のみ記載されている箇所は、`https://docs.google.com/spreadsheets/d/<ID>/edit` として再構成する。
3. 実装進捗管理シート(`https://docs.google.com/spreadsheets/d/1679CPPuWq4lciwe4BsJTfjJpiZKvKWogETwtauPThYw/edit`)は全エントリ共通の候補として常に含める。

### 他の Claude Code セッションからの利用方法

新しい実装に着手する前に、以下の raw URL を WebFetch で直接取得することで、類似の過去知見(実装方法・落とし穴・関連スプレッドシート)を参照できる。

```
https://raw.githubusercontent.com/gurii-gabreh/Knowledge-Dashboard/main/data/knowledge-index.json
```

### GitHub Pages について

`index.html` を GitHub Pages で公開するには、リポジトリの Settings → Pages で有効化が必要(Source: Deploy from a branch、Branch: 公開したいブランチ / `/ (root)`)。**MCP 経由では Pages の有効化はできないため、これは人による手動作業が必須。**(過去に `ai-research-radar` で Pages の有効化を忘れてデプロイが2回失敗した経緯があるため要注意。)

---

## `dashboard.html` — Google Drive スプレッドシート一覧

これまで Google ドライブに蓄積してきたナレッジ用スプレッドシートの一覧ダッシュボード。

### Google Drive アクセスについて

Claude は Google Drive コネクタ経由でこのアカウント (`gurii.gabreh.0516@gmail.com`) のドライブに直接アクセスできる。
検索・メタデータ取得・内容の読み取りが可能なため、「Google Drive にアクセスできれば、そこに保存されたスプレッドシートにもアクセスできる」という認識は正しい。
このダッシュボードの `data/spreadsheets.json` も、その Drive アクセスでスプレッドシート一覧を検索・整理して生成した。

### 構成

- `dashboard.html` — スプレッドシート一覧を表示する単一の静的ページ。検索・カテゴリ絞り込み・並び替え・フォルダ単位の折りたたみに対応。ブラウザで直接開ける(外部依存なし、データも埋め込み済み)。
- `data/spreadsheets.json` — 一覧の元データ(id・タイトル・カテゴリ・URL・所有者・更新日時)。ダッシュボードを再生成する際のソース。

### 一覧の更新方法

Drive 上のスプレッドシートは増減するため、一覧は都度作り直す必要がある(自動同期の仕組みはまだ無い)。更新する場合は Claude に依頼して:

1. Google Drive コネクタで `mimeType = 'application/vnd.google-apps.spreadsheet'` を検索
2. `data/spreadsheets.json` を最新の内容で作り直す
3. `dashboard.html` 内に埋め込んでいる同じ内容(`DATA` 定数)も同期する

を行えばよい。
