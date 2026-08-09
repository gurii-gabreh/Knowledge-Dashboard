#!/usr/bin/env node
// progress-tracker-dashboard の tasks.json / requirements.json から実装ナレッジ・要件知見を
// 横断集約し、data/knowledge-index.json を生成する。
// 認証不要のpublicリポジトリraw contentのみを使うため、GitHub Actions上でも完結できる。

const fs = require("fs");
const path = require("path");

const TASKS_URL =
  "https://raw.githubusercontent.com/gurii-gabreh/progress-tracker-dashboard/main/data/tasks.json";
const REQUIREMENTS_URL =
  "https://raw.githubusercontent.com/gurii-gabreh/progress-tracker-dashboard/main/data/requirements.json";
const OUTPUT_PATH = path.join(__dirname, "..", "data", "knowledge-index.json");

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

function hasKnowledge(task) {
  const detail = (task.detail || "").trim();
  const issues = (task.issues || "").trim();
  return Boolean(detail) || Boolean(issues);
}

// tasks.json の各タスク(subtasksも再帰的に)を平坦化し、ナレッジを持つものだけ抽出する
function flattenTasks(tasks) {
  const items = [];

  function walk(task, parentId, depth, inheritedRepo) {
    const repo = task.repo || inheritedRepo || null;
    if (hasKnowledge(task)) {
      items.push({
        type: "task",
        id: task.id || null,
        parentId: parentId || null,
        depth,
        repo,
        title: task.title || null,
        task: task.task || null,
        status: task.status || null,
        priority: task.priority || null,
        updated: task.updated || null,
        detail: task.detail || "",
        issues: task.issues || "",
        output: task.output || "",
        nextAction: task.nextAction || null,
      });
    }
    for (const sub of task.subtasks || []) {
      walk(sub, task.id || parentId, depth + 1, repo);
    }
  }

  for (const task of tasks) walk(task, null, 0, null);
  return items;
}

// requirements.json の requirements 配列(新規リポジトリの要件定義)を抽出する
function extractRequirements(requirements) {
  return (requirements || []).map((req, i) => ({
    type: "requirement",
    id: req.id || `REQ-${i + 1}`,
    ...req,
  }));
}

// userProfile.patterns のうち、ユーザー自身が確認済み(confirmedByUser: true)のものだけ抽出する
function extractUserPatterns(userProfile) {
  const patterns = (userProfile && userProfile.patterns) || [];
  return patterns
    .filter((p) => p.confirmedByUser === true)
    .map((p) => ({ type: "userPattern", ...p }));
}

function readExisting() {
  try {
    return JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf8"));
  } catch (e) {
    return null;
  }
}

async function main() {
  const [tasksData, requirementsData] = await Promise.all([
    fetchJson(TASKS_URL),
    fetchJson(REQUIREMENTS_URL),
  ]);

  const taskItems = flattenTasks(tasksData.tasks || []);
  const requirementItems = extractRequirements(requirementsData.requirements);
  const userPatternItems = extractUserPatterns(requirementsData.userProfile);
  const knownRepos = tasksData.knownRepos || [];
  const items = [...taskItems, ...requirementItems, ...userPatternItems];

  // 内容(items/knownRepos)に変化が無ければ generatedAt を据え置き、無意味な差分コミットを避ける
  const existing = readExisting();
  const unchanged =
    existing &&
    JSON.stringify(existing.items) === JSON.stringify(items) &&
    JSON.stringify(existing.knownRepos) === JSON.stringify(knownRepos);
  const generatedAt = unchanged ? existing.generatedAt : new Date().toISOString();

  const output = {
    generatedAt,
    description:
      "gurii-gabreh/progress-tracker-dashboard の実装タスク(detail/issues)・新規リポジトリ要件定義・ユーザー思考パターンを横断集約したナレッジインデックス。Claude Codeなど他セッションがこのファイルを直接fetchして過去の実装知見を参照する用途を想定。",
    source: {
      tasks: TASKS_URL,
      requirements: REQUIREMENTS_URL,
    },
    knownRepos,
    counts: {
      tasks: taskItems.length,
      requirements: requirementItems.length,
      userPatterns: userPatternItems.length,
      total: items.length,
    },
    items,
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + "\n");
  console.log(
    `Wrote ${OUTPUT_PATH}: ${output.counts.total} items (tasks=${output.counts.tasks}, requirements=${output.counts.requirements}, userPatterns=${output.counts.userPatterns})${unchanged ? " [content unchanged, generatedAt kept]" : ""}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
