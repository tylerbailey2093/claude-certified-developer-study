// Compiles objective MDX without a full site build, so authors catch syntax
// errors (unescaped { or <, broken JSX props) in seconds. Read-only and safe
// to run while other agents work.
//
//   npx tsx scripts/check_mdx.ts                       # all objectives
//   npx tsx scripts/check_mdx.ts --objective claude-hooks
import fs from 'node:fs';
import path from 'node:path';
import { compile } from '@mdx-js/mdx';
import { ODIR } from './lib/load.ts';

const args = process.argv.slice(2);
const only = args.includes('--objective') ? args[args.indexOf('--objective') + 1] : undefined;
const KNOWN = new Set(['Callout', 'PostGuide', 'Recall', 'ObjLink', 'SubskillAnchor', 'Walkthrough', 'Step', 'Output', 'Flow', 'Sequence']);

let failed = 0;
for (const f of fs.readdirSync(ODIR).filter((f) => f.endsWith('.mdx')).sort()) {
  if (only && f !== `${only}.mdx`) continue;
  const src = fs.readFileSync(path.join(ODIR, f), 'utf8').replace(/^---\n[\s\S]*?\n---\n/, '');
  try {
    await compile(src, { jsx: true });
    const unknown = [...src.replace(/```[\s\S]*?```/g, '').matchAll(/<([A-Z][A-Za-z]*)[\s/>]/g)].map((m) => m[1]).filter((n) => !KNOWN.has(n));
    if (unknown.length) {
      failed++;
      console.log(`✗ ${f}: unknown components ${[...new Set(unknown)].join(', ')}`);
    }
  } catch (e) {
    failed++;
    const err = e as { message: string; line?: number; column?: number };
    console.log(`✗ ${f}: ${err.message.split('\n')[0]}${err.line ? ` (line ${err.line} after frontmatter)` : ''}`);
  }
}
if (failed) process.exit(1);
console.log('PASS: MDX compiles');
