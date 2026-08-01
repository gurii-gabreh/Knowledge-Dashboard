# Knowledge Dashboard

これまで Google ドライブに蓄積してきたナレッジ用スプレッドシートの一覧ダッシュボード。

## Google Drive アクセスについて

Claude は Google Drive コネクタ経由でこのアカウント (`gurii.gabreh.0516@gmail.com`) のドライブに直接アクセスできる。
検索・メタデータ取得・内容の読み取りが可能なため、「Google Drive にアクセスできれば、そこに保存されたスプレッドシートにもアクセスできる」という認識は正しい。
このダッシュボードの `data/spreadsheets.json` も、その Drive アクセスでスプレッドシート一覧を検索・整理して生成した。

## 構成

- `dashboard.html` — スプレッドシート一覧を表示する単一の静的ページ。検索・カテゴリ絞り込み・並び替え・フォルダ単位の折りたたみに対応。ブラウザで直接開ける（外部依存なし、データも埋め込み済み）。
- `data/spreadsheets.json` — 一覧の元データ（id・タイトル・カテゴリ・URL・所有者・更新日時）。ダッシュボードを再生成する際のソース。

## 一覧の更新方法

Drive 上のスプレッドシートは増減するため、一覧は都度作り直す必要がある（自動同期の仕組みはまだ無い）。更新する場合は Claude に依頼して:

1. Google Drive コネクタで `mimeType = 'application/vnd.google-apps.spreadsheet'` を検索
2. `data/spreadsheets.json` を最新の内容で作り直す
3. `dashboard.html` 内に埋め込んでいる同じ内容（`DATA` 定数）も同期する

を行えばよい。定期的に自動更新したい場合は、既存の `progress-tracker-dashboard` プロジェクトと同様に Routine（自己バインドセッション）を組む方式が使える。
