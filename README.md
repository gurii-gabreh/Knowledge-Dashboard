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
- `gas/update-spreadsheets.gs` — 専用の Drive フォルダ内のショートカットからスプレッドシート一覧を解決し、`data/spreadsheets.json` を GitHub Contents API 経由で直接コミット・更新する Google Apps Script。時間主導トリガーで毎日自動実行される（デプロイ手順は後述）。

## 一覧の更新方法

### スプレッドシート一覧（`data/spreadsheets.json`）

以前は Drive 全体を都度検索して手動で作り直す必要があった（Google Drive 検索は認証が絡むため GitHub Actions での自動化はできなかった）。現在は専用の Drive フォルダとGoogle Apps Script (GAS) による自動更新に切り替えている。

#### 仕組み

- Drive 上に専用フォルダ（フォルダID: `1K7teb5iGkdphV78M773vxlhbNd2fnQxd`）を用意し、そこには実体ではなく**ショートカット**（Drive の「整理→ショートカットを追加」機能で作る参照オブジェクト）だけを置く運用にしている。既存のナレッジ系スプレッドシートは元の場所（フォルダ）から動かさない。新しいナレッジ DB が増えたら、このフォルダにショートカットを1つ追加するだけでよい。
- `gas/update-spreadsheets.gs` がこのフォルダ内のショートカット（直接スプレッドシートが置かれていた場合はそれも）を列挙し、拡張サービス「Drive API」でショートカットの参照先の実ファイルIDを解決した上で、メタデータ（タイトル・URL・所有者・作成日時・更新日時など）を集めて `data/spreadsheets.json` と互換のJSONを組み立てる。
- 組み立てたJSONは `UrlFetchApp` から GitHub Contents API を直接叩いて `data/spreadsheets.json` にコミットする。内容（`items`）に変化が無ければコミット自体をスキップする（`scripts/generate-knowledge-index.js` の「差分が無ければ generatedAt も据え置く」という既存方針を踏襲）。
- GAS はスクリプト所有者（ユーザー本人）の Google アカウント権限でそのまま `DriveApp` / `Drive` API を使えるため、GitHub Actions のようにサービスアカウント等の別認証を持ち込む必要が無い。時間主導トリガーで `.github/workflows/update-knowledge-index.yml` と同じ毎日06:00 JST頃に自動実行される。

#### デプロイ手順（ユーザーが一度だけ手動で行う）

1. [script.google.com](https://script.google.com/) で新規スタンドアロンプロジェクトを作成し、`gas/update-spreadsheets.gs` の内容を貼り付ける
2. 左側メニュー「サービス」の＋から拡張サービス「Drive API」を追加する（バージョン選択が出た場合は v3 を選ぶ）。`DriveApp` だけではショートカットの参照先（`shortcutDetails.targetId`）を取得できないため必須
3. 左側メニュー「プロジェクトの設定」→「スクリプト プロパティ」に `GITHUB_TOKEN`（`data/spreadsheets.json` への書き込み権限を持つ GitHub Personal Access Token）を追加する
4. エディタの関数選択ドロップダウンで `setupDailyTrigger` を選び、一度だけ手動実行する（Drive・外部リクエストへのアクセス許可を求める認可ダイアログが出るので許可する。これで日次トリガーが作成される）
5. 動作確認したい場合は `updateSpreadsheetsJson` を直接実行してもよい

これでフォルダにショートカットを追加するだけで、翌日以降 `data/spreadsheets.json` に自動反映されるようになる。`dashboard.html` に埋め込んでいる同じ内容（`DATA` 定数）は自動更新の対象外なので、埋め込みデータも最新化したい場合は Claude に依頼して同期する。

### 実装ナレッジ（`data/knowledge-index.json`）

`.github/workflows/update-knowledge-index.yml` により毎日自動更新される（手動で再生成したい場合は `node scripts/generate-knowledge-index.js` を実行してコミットすればよい）。
