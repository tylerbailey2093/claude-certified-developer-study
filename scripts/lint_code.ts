// Lints code examples in objective MDX and lab notebooks.
//
//   - model IDs must be in src/data/facts.json
//   - every messages.create / .stream / .parse call and every batch params
//     object sets max_tokens
//   - never read content[0].text (the first block can be thinking)
//   - no sampling params, budget_tokens, forced tool_choice or output_format
//     with current models, unless the block is demonstrating the 400 it causes
//   - Python parses (ast) and TypeScript parses (esbuild)
//
// Objectives in scripts/strict-objectives.json (or --strict) fail on findings;
// others only warn while their rewrite is pending.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { transformSync } from 'esbuild';
import { ROOT, ODIR } from './lib/load.ts';
import facts from '../src/data/facts.json' with { type: 'json' };

const args = process.argv.slice(2);
const forceStrict = args.includes('--strict');
const only = args.includes('--objective') ? args[args.indexOf('--objective') + 1] : undefined;
const strictList: string[] = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/strict-objectives.json'), 'utf8'));

const allowed = new Set([...facts.allowedModelIds, ...facts.legacyIdsAllowedInMigrationExamples]);
type Block = { src: string; owner: string; lang: 'python' | 'typescript'; code: string; line: number };
const blocks: Block[] = [];

for (const f of fs.readdirSync(ODIR).filter((f) => f.endsWith('.mdx'))) {
  const id = f.replace(/\.mdx$/, '');
  if (only && id !== only) continue;
  const text = fs.readFileSync(path.join(ODIR, f), 'utf8');
  for (const m of text.matchAll(/```(python|py|typescript|ts)\n([\s\S]*?)```/g)) {
    const line = text.slice(0, m.index).split('\n').length;
    blocks.push({ src: f, owner: id, lang: m[1].startsWith('p') ? 'python' : 'typescript', code: m[2], line });
  }
}
const LABS = path.join(ROOT, 'labs');
if (!only && fs.existsSync(LABS)) {
  for (const f of fs.readdirSync(LABS).filter((f) => f.endsWith('.ipynb'))) {
    const nb = JSON.parse(fs.readFileSync(path.join(LABS, f), 'utf8'));
    nb.cells.forEach((c: { cell_type: string; source: string[] | string }, i: number) => {
      if (c.cell_type !== 'code') return;
      const code = Array.isArray(c.source) ? c.source.join('') : c.source;
      if (code.trim().startsWith('%') || code.trim().startsWith('!')) return;
      blocks.push({ src: f, owner: `lab:${f}`, lang: 'python', code, line: i + 1 });
    });
  }
}

type Finding = { where: string; owner: string; rule: string; msg: string };
const findings: Finding[] = [];
const add = (b: Block, rule: string, msg: string) => findings.push({ where: `${b.src}:${b.line}`, owner: b.owner, rule, msg });

/** Return the text of each call starting at `start` up to its matching close paren. */
function calls(code: string, re: RegExp): string[] {
  const out: string[] = [];
  for (const m of code.matchAll(re)) {
    let i = m.index! + m[0].length - 1; // at '('
    let depth = 0;
    let j = i;
    for (; j < code.length; j++) {
      const ch = code[j];
      if (ch === '(' || ch === '{' || ch === '[') depth++;
      else if (ch === ')' || ch === '}' || ch === ']') {
        depth--;
        if (depth === 0) break;
      }
    }
    out.push(code.slice(i, j + 1));
  }
  return out;
}

for (const b of blocks) {
  const demo400 = /\b400\b|BadRequest|invalid_request_error/.test(b.code);
  for (const m of b.code.match(/\bclaude-[a-z]+(?:-[0-9a-z.]+)+\b/g) ?? []) {
    if (!allowed.has(m)) add(b, 'model-id', `model id "${m}" is not in facts.json`);
  }
  for (const c of calls(b.code, /messages\.(?:create|stream|parse)\s*\(/g)) {
    if (!/max_tokens/.test(c)) add(b, 'max-tokens', 'messages call without max_tokens');
  }
  if (/batches\.create/.test(b.code) && /params/.test(b.code) && !/max_tokens/.test(b.code)) add(b, 'max-tokens', 'batch params without max_tokens');
  if (/content\[0\]\.text|content\[0\]\["text"\]/.test(b.code)) add(b, 'first-block', 'reads content[0].text; the first block can be a thinking block');
  if (!demo400) {
    if (/\b(temperature|top_p|top_k)\s*[=:]/.test(b.code)) add(b, 'sampling', 'sampling parameter; rejected on current models (show it only to demonstrate the 400)');
    if (/budget_tokens/.test(b.code)) add(b, 'budget-tokens', 'budget_tokens is rejected on current models; use adaptive thinking + effort');
    if (/tool_choice[^\n]*(["']any["']|["']tool["'])/.test(b.code)) add(b, 'tool-choice', 'forced tool_choice is rejected on current models; use auto + strict or structured outputs');
  }
  if (/\boutput_format\b/.test(b.code)) add(b, 'output-format', 'output_format is deprecated; use output_config.format');
  if (b.lang === 'typescript') {
    try {
      transformSync(b.code, { loader: 'ts', format: 'esm' });
    } catch (e) {
      add(b, 'ts-syntax', String((e as Error).message).split('\n')[0].slice(0, 160));
    }
  }
}

// Python syntax in one subprocess.
const py = blocks.filter((b) => b.lang === 'python');
if (py.length) {
  const res = execFileSync(
    'python3',
    [
      '-c',
      'import ast,json,sys\nout=[]\nfor i,c in enumerate(json.load(sys.stdin)):\n  try: ast.parse(c)\n  except SyntaxError as e: out.append([i,f"{e.msg} (line {e.lineno})"])\nprint(json.dumps(out))',
    ],
    { input: JSON.stringify(py.map((b) => b.code)) }
  ).toString();
  for (const [i, msg] of JSON.parse(res) as [number, string][]) add(py[i], 'py-syntax', msg);
}

const isStrict = (owner: string) => forceStrict || strictList.includes(owner);
const errors = findings.filter((f) => isStrict(f.owner));
const warns = findings.filter((f) => !isStrict(f.owner));
const byRule = (fs: Finding[]) =>
  Object.entries(fs.reduce<Record<string, number>>((m, f) => ((m[f.rule] = (m[f.rule] ?? 0) + 1), m), {}))
    .map(([r, n]) => `${r}:${n}`)
    .join('  ');
console.log(`${blocks.length} code blocks · errors ${errors.length} ${byRule(errors)} · warnings ${warns.length} ${byRule(warns)}`);
for (const f of (only ? findings : errors).slice(0, 60)) console.log(`  ${isStrict(f.owner) ? '✗' : '!'} ${f.where} [${f.rule}] ${f.msg}`);
if (errors.length) process.exit(1);
console.log('PASS: code lint');
