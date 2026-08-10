/**
 * Knowledge-Dashboard: data/spreadsheets.json の自動更新
 *
 * 背景: これまで data/spreadsheets.json は Google Drive 全体を検索して手動で作り直す必要があった
 * (Drive 検索には認証が絡むため GitHub Actions では自動化できなかった)。この GAS はその代わりに、
 * ユーザーが専用に作成した Drive フォルダ(SOURCE_FOLDER_ID)を毎日スキャンし、直接 GitHub へ
 * コミットすることで自動更新する。GAS はスクリプト所有者(ユーザー)本人の Google アカウント権限で
 * そのまま DriveApp / Drive API を使えるため、サービスアカウント等の別認証を持ち込む必要が無い。
 *
 * 運用方針: 既存のナレッジ系スプレッドシートは元の場所(フォルダ)から動かさない。
 * SOURCE_FOLDER_ID のフォルダには実体ではなく「ショートカット」(Drive の「整理→ショートカットを
 * 追加」で作る参照オブジェクト)だけを置く。新しいナレッジ DB が増えたら、ユーザーがこのフォルダに
 * ショートカットを 1 つ追加するだけでよい。
 *
 * デプロイ手順(ユーザーが一度だけ手動で行う):
 *   1. script.google.com で新規スタンドアロンプロジェクトを作成し、このファイルの内容を貼り付ける
 *   2. 左側メニュー「サービス」の + から拡張サービス「Drive API」を追加する(バージョン選択画面が
 *      出た場合は v3 を選ぶ)。DriveApp だけではショートカットの参照先
 *      (shortcutDetails.targetId) を取得できないため、この拡張サービス(グローバル変数 `Drive`)が必要
 *   3. 左側メニュー「プロジェクトの設定」→「スクリプト プロパティ」に以下を追加する:
 *        GITHUB_TOKEN : data/spreadsheets.json への書き込み権限(Contents API、repo スコープ)を持つ
 *                        GitHub Personal Access Token
 *   4. エディタの関数選択ドロップダウンで setupDailyTrigger を選び、一度だけ手動実行する
 *      (Drive・外部リクエストの認可ダイアログが出るので許可する。日次トリガーもここで作成される)
 *   5. 動作確認したい場合は updateSpreadsheetsJson を直接実行してもよい(内容に変化が無ければ
 *      コミットはスキップされる)
 */

const SOURCE_FOLDER_ID = '1K7teb5iGkdphV78M773vxlhbNd2fnQxd';
const GITHUB_OWNER = 'gurii-gabreh';
const GITHUB_REPO = 'Knowledge-Dashboard';
const GITHUB_BRANCH = 'main';
const GITHUB_TARGET_PATH = 'data/spreadsheets.json';
const SPREADSHEET_MIME_TYPE = 'application/vnd.google-apps.spreadsheet';
const SHORTCUT_MIME_TYPE = 'application/vnd.google-apps.shortcut';
const MAX_FOLDER_WALK_DEPTH = 6; // フォルダの親を遡る上限(パンくずの簡略化。無限ループ防止も兼ねる)

/** メインエントリポイント。日次トリガーから呼ばれる想定(手動実行も可)。 */
function updateSpreadsheetsJson() {
  const items = collectSpreadsheetItems_();
  items.sort(function (a, b) {
    if (a.modifiedTime === b.modifiedTime) return a.id < b.id ? -1 : 1;
    return a.modifiedTime < b.modifiedTime ? 1 : -1; // 更新日時の新しい順(既存データの並びに合わせる)
  });

  const existing = fetchExistingFile_();

  // 内容(items)に変化が無ければ generatedAt も据え置き、コミット自体をスキップする
  // (generate-knowledge-index.js の既存方針を踏襲。無意味な差分コミットを避ける)。
  const unchanged = existing && JSON.stringify(existing.json.items) === JSON.stringify(items);
  if (unchanged) {
    Logger.log('内容に変化が無いため、コミットをスキップしました (items=%s件)', items.length);
    return { ok: true, committed: false, count: items.length };
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    source: 'Google Drive folder ' + SOURCE_FOLDER_ID + ' (shortcuts) via Apps Script (update-spreadsheets.gs)',
    owner: Session.getActiveUser().getEmail() || (existing && existing.json.owner) || '',
    items: items,
  };

  commitToGithub_(payload, existing ? existing.sha : null);
  Logger.log('data/spreadsheets.json を更新しました (items=%s件)', items.length);
  return { ok: true, committed: true, count: items.length };
}

/** SOURCE_FOLDER_ID 直下のショートカット(または直接置かれたスプレッドシート)を列挙し、メタデータ配列を返す */
function collectSpreadsheetItems_() {
  const folder = DriveApp.getFolderById(SOURCE_FOLDER_ID);
  const fileIter = folder.getFiles();
  const items = [];
  const seenIds = {};

  while (fileIter.hasNext()) {
    const file = fileIter.next();
    const mimeType = file.getMimeType();
    let targetId = null;

    if (mimeType === SHORTCUT_MIME_TYPE) {
      targetId = resolveShortcutTarget_(file.getId());
    } else if (mimeType === SPREADSHEET_MIME_TYPE) {
      targetId = file.getId(); // ショートカットではなく直接置かれていた場合はそのまま使う
    } else {
      continue; // スプレッドシートでもショートカットでもないファイルは対象外
    }
    if (!targetId || seenIds[targetId]) continue;
    seenIds[targetId] = true;

    const meta = fetchSpreadsheetMeta_(targetId);
    if (meta) items.push(meta);
  }
  return items;
}

/** ショートカットの参照先の実ファイルIDを解決する(基本のDriveAppでは取得できないため拡張サービスDriveを使う) */
function resolveShortcutTarget_(shortcutId) {
  try {
    const meta = Drive.Files.get(shortcutId, { fields: 'shortcutDetails' });
    return (meta.shortcutDetails && meta.shortcutDetails.targetId) || null;
  } catch (e) {
    Logger.log('ショートカットの参照先解決に失敗したためスキップ: %s (%s)', shortcutId, e);
    return null;
  }
}

/** 実ファイルIDからスプレッドシートのメタデータを取得する。スプレッドシート以外・ゴミ箱内は null を返す */
function fetchSpreadsheetMeta_(fileId) {
  let file;
  try {
    file = Drive.Files.get(fileId, {
      fields: 'id,name,mimeType,webViewLink,owners,createdTime,modifiedTime,shared,parents,trashed',
    });
  } catch (e) {
    Logger.log('メタデータ取得に失敗したためスキップ: %s (%s)', fileId, e);
    return null;
  }
  if (!file || file.trashed || file.mimeType !== SPREADSHEET_MIME_TYPE) return null;

  const owner = file.owners && file.owners[0] ? file.owners[0].emailAddress : '';
  const activeEmail = Session.getActiveUser().getEmail();
  const rootLabel = owner && activeEmail && owner !== activeEmail ? '共有アイテム' : 'マイドライブ';
  const folderPath = resolveFolderPath_(file.parents && file.parents[0], rootLabel);

  return {
    id: file.id,
    title: file.name,
    url: file.webViewLink || 'https://docs.google.com/spreadsheets/d/' + file.id + '/edit',
    category: buildCategory_(folderPath),
    folderPath: folderPath,
    owner: owner,
    shared: !!file.shared,
    createdTime: file.createdTime,
    modifiedTime: file.modifiedTime,
  };
}

/**
 * フォルダの親を rootLabel まで遡り、パンくず配列を作る(簡略版)。アクセス権が無い等で
 * 途中までしか辿れない場合はそこで打ち切る。完全なパンくず解決はせず、id/title/url の正確性を優先する。
 */
function resolveFolderPath_(startParentId, rootLabel) {
  const names = [];
  let currentId = startParentId;
  let depth = 0;
  while (currentId && depth < MAX_FOLDER_WALK_DEPTH) {
    let folder;
    try {
      folder = Drive.Files.get(currentId, { fields: 'name,parents' });
    } catch (e) {
      break;
    }
    names.unshift(folder.name);
    currentId = folder.parents && folder.parents[0];
    depth++;
  }
  return names.length ? [rootLabel].concat(names) : [rootLabel];
}

/** 簡略化した自動カテゴリ分類(既存データの手作業カテゴリ名とは完全一致しない) */
function buildCategory_(folderPath) {
  if (folderPath[0] === '共有アイテム' && folderPath.length <= 1) return '共有 (他ユーザー所有)';
  if (folderPath.length <= 1) return folderPath[0] + '直下';
  return folderPath.slice(1).join(' / ');
}

/** GitHub Contents API から data/spreadsheets.json の現在の内容とblob shaを取得する(更新に必須) */
function fetchExistingFile_() {
  const url =
    'https://api.github.com/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO + '/contents/' + GITHUB_TARGET_PATH +
    '?ref=' + GITHUB_BRANCH;
  const res = UrlFetchApp.fetch(url, { headers: githubHeaders_(), muteHttpExceptions: true });
  if (res.getResponseCode() === 404) return null; // ファイルがまだ存在しない場合は新規作成扱い
  if (res.getResponseCode() !== 200) {
    throw new Error('既存ファイルの取得に失敗しました: ' + res.getResponseCode() + ' ' + res.getContentText());
  }
  const body = JSON.parse(res.getContentText());
  const decoded = Utilities.newBlob(Utilities.base64Decode(body.content.replace(/\n/g, ''))).getDataAsString('UTF-8');
  return { sha: body.sha, json: JSON.parse(decoded) };
}

/** data/spreadsheets.json をGitHub Contents APIでコミットする(sha が null の場合は新規作成) */
function commitToGithub_(payload, sha) {
  const text = JSON.stringify(payload, null, 2) + '\n';
  const url = 'https://api.github.com/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO + '/contents/' + GITHUB_TARGET_PATH;
  const body = {
    message: 'chore: update spreadsheets.json (' + payload.items.length + ' items) via Apps Script',
    content: Utilities.base64Encode(Utilities.newBlob(text, 'application/json').getBytes()),
    branch: GITHUB_BRANCH,
  };
  if (sha) body.sha = sha;

  const res = UrlFetchApp.fetch(url, {
    method: 'put',
    contentType: 'application/json',
    headers: githubHeaders_(),
    payload: JSON.stringify(body),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() >= 300) {
    throw new Error('GitHubへのコミットに失敗しました: ' + res.getResponseCode() + ' ' + res.getContentText());
  }
}

/** GitHub API 用ヘッダー。トークンはコード内にハードコードせず、スクリプト プロパティの GITHUB_TOKEN から読む */
function githubHeaders_() {
  const token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) throw new Error('スクリプト プロパティ GITHUB_TOKEN が未設定です');
  return {
    Authorization: 'Bearer ' + token,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

/**
 * 初回セットアップ時に一度だけ手動実行してください(既存の同名トリガーは削除して作り直します)。
 * .github/workflows/update-knowledge-index.yml と同じ毎日06:00 JST頃に updateSpreadsheetsJson を実行する。
 */
function setupDailyTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'updateSpreadsheetsJson') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('updateSpreadsheetsJson')
    .timeBased()
    .atHour(6)
    .nearMinute(0)
    .everyDays(1)
    .inTimezone('Asia/Tokyo')
    .create();
  Logger.log('日次トリガーを設定しました(毎日06:00 JST頃に updateSpreadsheetsJson を実行)');
}
