#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const SOURCE_URL =
  'https://raw.githubusercontent.com/gurii-gabreh/progress-tracker-dashboard/main/data/tasks.json';
const OUTPUT_PATH = path.join(__dirname, '..', 'data', 'knowledge-index.json');

// Always offered as a candidate spreadsheet link on every entry, per project convention.
const COMMON_SPREADSHEETS = [
  'https://docs.google.com/spreadsheets/d/1679CPPuWq4lciwe4BsJTfjJpiZKvKWogETwtauPThYw/edit',
];

const SPREADSHEET_URL_RE = /https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)[^\s"'`<>)\]]*/g;
// Matches labels like "SPREADSHEET_ID: <id>" or "SPREADSHEET_ID=<id>" (case-insensitive).
const SPREADSHEET_ID_RE = /SPREADSHEET_ID\s*[:=]\s*["'`]?([a-zA-Z0-9_-]{15,})/gi;

function spreadsheetIdOf(url) {
  const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

function extractSpreadsheetUrls(...texts) {
  const byId = new Map();
  const addUrl = (id, url) => {
    if (id && !byId.has(id)) byId.set(id, url);
  };

  for (const text of texts) {
    if (!text || typeof text !== 'string') continue;
    for (const match of text.matchAll(SPREADSHEET_URL_RE)) {
      addUrl(match[1], match[0].replace(/[.,)\]]+$/, ''));
    }
    for (const match of text.matchAll(SPREADSHEET_ID_RE)) {
      addUrl(match[1], `https://docs.google.com/spreadsheets/d/${match[1]}/edit`);
    }
  }

  for (const url of COMMON_SPREADSHEETS) {
    addUrl(spreadsheetIdOf(url), url);
  }

  return [...byId.values()];
}

function flatten(tasks, parentRepo, parentTask) {
  const out = [];
  for (const t of tasks || []) {
    const repo = t.repo || parentRepo || '';
    const entry = {
      repo,
      task: t.task || '',
      status: t.status || '',
      priority: t.priority || '',
      category: t.category || '',
      updated: t.updated || '',
      detail: t.detail || '',
      issues: t.issues || '',
      manualSetup: t.manualSetup || '',
      note: t.note || '',
      output: t.output || '',
      parentTask: parentTask || '',
      isSubtask: Boolean(parentTask),
      spreadsheetUrls: extractSpreadsheetUrls(t.detail, t.output, t.manualSetup, t.note),
    };
    out.push(entry);
    if (Array.isArray(t.subtasks) && t.subtasks.length) {
      out.push(...flatten(t.subtasks, repo, t.task || parentTask));
    }
  }
  return out;
}

async function main() {
  const res = await fetch(SOURCE_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${SOURCE_URL}: ${res.status} ${res.statusText}`);
  }
  const source = await res.json();
  const entries = flatten(source.tasks, null, null);

  const output = {
    generatedAt: new Date().toISOString(),
    source: SOURCE_URL,
    sheetUrl: source.sheetUrl || null,
    knownRepos: source.knownRepos || [],
    entryCount: entries.length,
    entries,
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n');
  console.log(`Wrote ${entries.length} entries to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
