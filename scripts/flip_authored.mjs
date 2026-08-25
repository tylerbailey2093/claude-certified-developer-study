#!/usr/bin/env node
// Flip `authored: false` -> `authored: true` in any objective .mdx whose body
// has actually been expanded past the placeholder comment left by the scaffold.
// Some authoring agents flip this themselves; this is the backstop for any that
// didn't, so the objective page's authored/legacy-fallback gate is accurate
// regardless of which agent wrote what.
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.resolve(import.meta.dirname, '../src/content/objectives');
const PLACEHOLDER_MARK = 'Mastery-depth content goes here';

let flipped = 0;
for (const file of fs.readdirSync(DIR)) {
  if (!file.endsWith('.mdx')) continue;
  const p = path.join(DIR, file);
  let s = fs.readFileSync(p, 'utf-8');
  const [, frontmatter, body] = s.match(/^(---[\s\S]*?---)([\s\S]*)$/) ?? [];
  if (!frontmatter) continue;
  const hasRealBody = body && !body.includes(PLACEHOLDER_MARK) && body.trim().length > 200;
  const isMarkedFalse = /^authored:\s*false\s*$/m.test(frontmatter);
  if (hasRealBody && isMarkedFalse) {
    s = s.replace(/^authored:\s*false\s*$/m, 'authored: true');
    fs.writeFileSync(p, s);
    flipped++;
    console.log(`flipped: ${file}`);
  }
}
console.log(`${flipped} file(s) flipped to authored: true`);
