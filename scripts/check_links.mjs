#!/usr/bin/env node
// Verify every internal link in the built site resolves to a file that exists.
//
// This exists because a malformed base path shipped once: BASE_URL had no
// trailing slash, templates built links as `${base}foo/`, and every internal
// link became "/repo-namefoo/" — 404 on GitHub Pages, invisible locally where
// base is just "/". Direct-URL curl checks passed; the site's own links were
// never followed. This walks the actual emitted HTML instead.
//
// Run against a production-style build:
//   BASE_PATH=/<repo> npm run build && node scripts/check_links.mjs /<repo>

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const base = (process.argv[2] || '/').replace(/\/$/, '');

if (!fs.existsSync(DIST)) {
  console.error('no dist/ — run a build first');
  process.exit(2);
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full) : [full];
  });
}

const htmlFiles = walk(DIST).filter((f) => f.endsWith('.html'));
const problems = [];
let checked = 0;

for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf-8');
  const rel = path.relative(DIST, file);
  for (const m of html.matchAll(/(?:href|src)="(\/[^"]*)"/g)) {
    const url = m[1];
    if (url.startsWith('//')) continue;            // protocol-relative → external
    checked++;

    // Every internal absolute URL must sit under the base path.
    if (base && !url.startsWith(base + '/') && url !== base + '/' && url !== base) {
      problems.push(`${rel}: "${url}" does not start with base "${base}/"`);
      continue;
    }

    const stripped = base ? url.slice(base.length) : url;
    const clean = stripped.split('#')[0].split('?')[0];
    if (!clean || clean === '/') continue;

    const candidates = [
      path.join(DIST, clean),
      path.join(DIST, clean, 'index.html'),
      path.join(DIST, clean.replace(/\/$/, '') + '.html'),
    ];
    if (!candidates.some((c) => fs.existsSync(c))) {
      problems.push(`${rel}: "${url}" → no file in dist/`);
    }
  }
}

console.log(`checked ${checked} internal links across ${htmlFiles.length} pages (base "${base || '/'}")`);
if (problems.length) {
  console.error(`\nFAIL: ${problems.length} broken internal link(s)\n`);
  for (const p of [...new Set(problems)].slice(0, 40)) console.error('  ' + p);
  process.exit(1);
}
console.log('PASS: every internal link resolves.');
