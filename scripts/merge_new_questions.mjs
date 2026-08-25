#!/usr/bin/env node
// Track 4 integration step: merges every agent-authored src/data/questions/new/<id>.json
// into the domain-keyed banks and all.json. Idempotent — safe to re-run as agents finish.
//
// Each new-question file is an independent write target (one per objective), so parallel
// authoring agents never touch the same file. This script is the single point where they
// get combined, after the fact, deliberately serialized.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const QDIR = path.join(ROOT, 'src/data/questions');
const NEWDIR = path.join(QDIR, 'new');

function readJSON(p) { return JSON.parse(fs.readFileSync(p, 'utf-8')); }

const existing = readJSON(path.join(QDIR, 'all.json'));
const existingIds = new Set(existing.map((q) => q.id));

let added = 0;
let skippedDupes = 0;
const perObjectiveNew = {};

if (fs.existsSync(NEWDIR)) {
  for (const file of fs.readdirSync(NEWDIR)) {
    if (!file.endsWith('.json')) continue;
    const items = readJSON(path.join(NEWDIR, file));
    if (!Array.isArray(items)) {
      console.error(`SKIP ${file}: not an array`);
      continue;
    }
    for (const q of items) {
      if (existingIds.has(q.id)) { skippedDupes++; continue; }
      existing.push(q);
      existingIds.add(q.id);
      perObjectiveNew[q.s] = (perObjectiveNew[q.s] ?? 0) + 1;
      added++;
    }
  }
}

// Re-split by domain and write.
const byDomain = {};
for (const q of existing) (byDomain[q.d] ??= []).push(q);

fs.writeFileSync(path.join(QDIR, 'all.json'), JSON.stringify(existing, null, 2));
for (const [d, items] of Object.entries(byDomain)) {
  fs.writeFileSync(path.join(QDIR, `d${d}.json`), JSON.stringify(items, null, 2));
}

console.log(`merged ${added} new items (${skippedDupes} duplicate ids skipped)`);
console.log(`total bank size: ${existing.length}`);
console.log('by objective (new items only):');
for (const [obj, n] of Object.entries(perObjectiveNew).sort((a, b) => b[1] - a[1])) {
  console.log(`  +${n}  ${obj}`);
}
