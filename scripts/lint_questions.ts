// Question-bank lint. Enforces docs/authoring/QUESTION_SPEC.md.
//
// Items with status "active" must pass every item rule. Unrepaired legacy items
// (status "needs-rationale") only warn, so the site keeps working while the
// content waves rewrite them. --strict makes every warning an error.
//
//   npx tsx scripts/lint_questions.ts                 # whole bank
//   npx tsx scripts/lint_questions.ts --objective claude-hooks
//   npx tsx scripts/lint_questions.ts --strict --json reports/lint.json
import fs from 'node:fs';
import path from 'node:path';
import { loadBank, ROOT, type LoadedQuestion } from './lib/load.ts';
import { OBJECTIVE_BY_ID } from '../src/lib/blueprint.ts';
import blueprint from '../blueprint.json' with { type: 'json' };
import facts from '../src/data/facts.json' with { type: 'json' };

const args = process.argv.slice(2);
const strict = args.includes('--strict');
const onlyObj = args.includes('--objective') ? args[args.indexOf('--objective') + 1] : undefined;
const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : undefined;

type Finding = { id: string; file: string; rule: string; msg: string; level: 'error' | 'warn' };
const findings: Finding[] = [];

const SOURCE_HOSTS = [
  'platform.claude.com',
  'docs.claude.com',
  'code.claude.com',
  'docs.anthropic.com',
  'www.anthropic.com',
  'anthropic.com',
  'claude.com',
  'support.claude.com',
  'modelcontextprotocol.io',
  'github.com',
  'developer.mozilla.org',
  'www.rfc-editor.org',
  'datatracker.ietf.org',
  'git-scm.com',
  'semver.org',
  'json-schema.org',
  'owasp.org',
  'genai.owasp.org',
  'csrc.nist.gov',
  'www.nist.gov',
  'agilemanifesto.org',
  'www.axelos.com',
  'docs.aws.amazon.com',
  'cloud.google.com',
  'learn.microsoft.com',
  'docs.pydantic.dev',
  'langchain-ai.github.io',
  'strandsagents.com',
  'ai.pydantic.dev',
];

const POSITIONAL =
  /\b(option|answer|choice)s?\s*\(?[A-F]\)?(?![a-z])|\b[A-F] and [A-F]\b|\boption\s*\d\b|\b(first|second|third|fourth|last) (option|answer|choice)\b|\(\s*[A-F]\s*\)/;
const ABOVE = /\b(all|none|both) of the above\b/i;
const MODEL_ID = /\bclaude-[a-z]+-[0-9][a-z0-9.-]*\b/g;
const allowedModels = new Set<string>([
  ...(facts as { allowedModelIds: string[] }).allowedModelIds,
  ...((facts as { legacyIdsAllowedInMigrationExamples?: string[] }).legacyIdsAllowedInMigrationExamples ?? []),
]);

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const shingles = (s: string, n = 4) => {
  const w = norm(s).split(' ');
  const out = new Set<string>();
  for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(' '));
  return out;
};
const jaccard = (a: Set<string>, b: Set<string>) => {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const uni = a.size + b.size - inter;
  return uni ? inter / uni : 0;
};

type BPObj = { name: string; id?: string; subskills?: { id: string }[] };
const subskillIds = new Set(
  (blueprint as unknown as { domains: { objectives: BPObj[] }[] }).domains.flatMap((d) =>
    d.objectives.flatMap((o) => (o.subskills ?? []).map((s) => s.id))
  )
);

const bank = loadBank().filter((q) => !onlyObj || q.objective === onlyObj);
const ids = new Map<string, string>();

function add(q: LoadedQuestion, rule: string, msg: string, hard = true) {
  const active = q.status === 'active';
  const level: Finding['level'] = strict || (hard && active) ? 'error' : 'warn';
  findings.push({ id: q.id, file: q._file, rule, msg, level });
}

for (const q of bank) {
  if (ids.has(q.id)) findings.push({ id: q.id, file: q._file, rule: 'duplicate-id', msg: `also in ${ids.get(q.id)}`, level: 'error' });
  ids.set(q.id, q._file);
  const obj = OBJECTIVE_BY_ID.get(q.objective);
  if (!obj) add(q, 'objective', `unknown objective "${q.objective}"`);
  else if (obj.domain !== q.domain) add(q, 'domain', `domain ${q.domain} but ${q.objective} is D${obj.domain}`);
  if (`${q.objective}.json` !== q._file) add(q, 'file', `item for ${q.objective} lives in ${q._file}`);

  // stem form
  const stem = q.stem.trim();
  const selectWord = { 2: 'two', 3: 'three' }[q.select as 2 | 3];
  if (q.type === 'multi') {
    if (!new RegExp(`select ${selectWord}\\b`, 'i').test(stem)) add(q, 'select-n', `multi item must say "Select ${selectWord}." in the stem`);
  } else if (/\bselect (two|three)\b/i.test(stem)) add(q, 'select-n', 'single item says "select two/three"');
  if (!/\?\s*$/.test(stem) && !/select (two|three)\.?\s*$/i.test(stem)) add(q, 'stem-end', 'stem must end with "?" or "Select two."');
  const sentences = stem.split(/(?<=[.?!])\s+(?=[A-Z])/).length;
  if (sentences < 2 || sentences > 5) add(q, 'stem-length', `${sentences} sentence(s); style is 2-4`, false);

  // options and rationales
  for (const o of q.options) {
    if (ABOVE.test(o.text)) add(q, 'above', `"${o.text.slice(0, 40)}" uses all/none of the above`);
    if (words(o.why) < 8) add(q, 'why', `option ${o.id} has no rationale of 8+ words`);
    if (POSITIONAL.test(o.why)) add(q, 'positional', `option ${o.id} rationale refers to a position`);
  }
  if (POSITIONAL.test(q.explanation)) add(q, 'positional', 'explanation refers to an option by position or letter');

  // cue
  if (!q.cue) add(q, 'cue', 'missing cue (the deciding words in the stem)');
  else if (!stem.toLowerCase().includes(q.cue.toLowerCase())) add(q, 'cue', `cue "${q.cue}" is not verbatim in the stem`);

  // classification
  if (q.pattern === 'unclassified') add(q, 'pattern', 'pattern is unclassified');
  if (!q.subskills.length) add(q, 'subskills', 'no subskill tags', subskillIds.size > 0);
  for (const s of q.subskills) if (subskillIds.size && !subskillIds.has(s)) add(q, 'subskills', `unknown subskill "${s}"`);

  // sources
  if (!q.sources.length) add(q, 'sources', 'no source');
  for (const s of q.sources) {
    let host = '';
    try {
      host = new URL(s.url).host;
    } catch {}
    if (!SOURCE_HOSTS.includes(host)) add(q, 'source-host', `source host "${host}" not on the allowlist`);
  }
  if (!q.verified) add(q, 'verified', 'no verified date', false);

  // model IDs
  const text = [q.stem, q.explanation, ...q.options.flatMap((o) => [o.text, o.why])].join(' ');
  for (const m of text.match(MODEL_ID) ?? []) if (!allowedModels.has(m)) add(q, 'model-id', `model id "${m}" not in facts.json`);

  // length tell, per item (singles)
  if (q.type === 'single') {
    const correct = q.options.find((o) => o.id === q.answer[0])!;
    const others = q.options.filter((o) => o.id !== correct.id);
    const longestOther = Math.max(...others.map((o) => o.text.length));
    if (correct.text.length > 1.25 * longestOther) add(q, 'length-tell', `correct option is ${(correct.text.length / longestOther).toFixed(2)}x the longest distractor (max 1.25)`, false);
    if (!others.some((o) => Math.abs(o.text.length - correct.text.length) <= 0.15 * correct.text.length))
      add(q, 'length-tell', 'no distractor within 15% of the correct option length', false);
  }
}

// ---------------------------------------------------------- bank-level --
const singles = bank.filter((q) => q.type === 'single' && q.status !== 'retired');
const isLongest = (q: LoadedQuestion) => {
  const c = q.options.find((o) => o.id === q.answer[0])!.text.length;
  return q.options.every((o) => o.id === q.answer[0] || o.text.length < c);
};
const activeSingles = singles.filter((q) => q.status === 'active');
const share = (qs: LoadedQuestion[]) => (qs.length ? qs.filter(isLongest).length / qs.length : 0);
const bankShare = share(singles);
const activeShare = share(activeSingles);
const bankLevel: string[] = [];
if (activeSingles.length >= 20 && activeShare > 0.4) bankLevel.push(`active singles: correct option is longest in ${(activeShare * 100).toFixed(0)}% (max 40%)`);
const byObj = new Map<string, LoadedQuestion[]>();
for (const q of activeSingles) byObj.set(q.objective, [...(byObj.get(q.objective) ?? []), q]);
for (const [o, qs] of byObj) if (qs.length >= 8 && share(qs) > 0.5) bankLevel.push(`${o}: correct option is longest in ${(share(qs) * 100).toFixed(0)}% of active singles (max 50%)`);

// absolute words only in distractors
const ABS = /\b(always|never|guarantee[sd]?|only|must|all|every)\b/i;
let absD = 0;
let absC = 0;
for (const q of activeSingles) for (const o of q.options) if (ABS.test(o.text)) q.answer.includes(o.id) ? absC++ : absD++;
if (absD + absC >= 20 && absD / (absD + absC) > 0.85) bankLevel.push(`absolute words appear in distractors ${absD} times vs correct options ${absC}: a learnable tell`);

// near-duplicate stems
const sh = bank.map((q) => ({ q, s: shingles(q.stem) }));
for (let i = 0; i < sh.length; i++)
  for (let j = i + 1; j < sh.length; j++) {
    const jac = jaccard(sh[i].s, sh[j].s);
    if (jac >= 0.6) findings.push({ id: sh[i].q.id, file: sh[i].q._file, rule: 'near-duplicate', msg: `stem ${(jac * 100).toFixed(0)}% overlaps ${sh[j].q.id}`, level: 'error' });
    else if (jac >= 0.45) findings.push({ id: sh[i].q.id, file: sh[i].q._file, rule: 'near-duplicate', msg: `stem ${(jac * 100).toFixed(0)}% overlaps ${sh[j].q.id}`, level: 'warn' });
  }

// ---------------------------------------------------------------- report --
const errors = findings.filter((f) => f.level === 'error');
const warns = findings.filter((f) => f.level === 'warn');
const byRule = (fs: Finding[]) =>
  Object.entries(fs.reduce<Record<string, number>>((m, f) => ((m[f.rule] = (m[f.rule] ?? 0) + 1), m), {}))
    .sort((a, b) => b[1] - a[1])
    .map(([r, n]) => `${r}:${n}`)
    .join('  ');

const active = bank.filter((q) => q.status === 'active').length;
console.log(`items ${bank.length} (active ${active}, legacy ${bank.length - active})${onlyObj ? ` · objective ${onlyObj}` : ''}`);
console.log(`multi-response ${bank.filter((q) => q.type === 'multi').length} · longest-correct: all singles ${(bankShare * 100).toFixed(0)}%, active singles ${(activeShare * 100).toFixed(0)}%`);
console.log(`errors ${errors.length}  ${byRule(errors)}`);
console.log(`warnings ${warns.length}  ${byRule(warns)}`);
for (const f of errors.slice(0, 40)) console.log(`  ✗ ${f.file} ${f.id} [${f.rule}] ${f.msg}`);
if (errors.length > 40) console.log(`  … ${errors.length - 40} more`);
for (const b of bankLevel) console.log(`  ✗ bank: ${b}`);

if (jsonOut) {
  fs.mkdirSync(path.dirname(path.resolve(ROOT, jsonOut)), { recursive: true });
  fs.writeFileSync(path.resolve(ROOT, jsonOut), JSON.stringify({ findings, bankLevel, bankShare, activeShare }, null, 2));
}
if (errors.length || bankLevel.length) process.exit(1);
console.log('PASS: question lint');
