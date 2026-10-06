// Blueprint and objective-structure gate. Enforces docs/authoring/AUTHORING_SPEC.md.
//
// Always: blueprint invariants and frontmatter/blueprint agreement for all 25 pages.
// Strict (objectives listed in scripts/strict-objectives.json, or --strict):
// v2 frontmatter, required sections in order, one SubskillAnchor per guide
// sub-skill, recall checks, diagram, walkthrough, cross-links, word target, no em dashes.
//
//   npx tsx scripts/check_blueprint.ts
//   npx tsx scripts/check_blueprint.ts --strict --objective prompt-engineering
import fs from 'node:fs';
import path from 'node:path';
import { DOMAINS, MOCK_COMPOSITION, OBJECTIVES, OBJECTIVE_BY_ID } from '../src/lib/blueprint.ts';
import { readObjectives, ROOT } from './lib/load.ts';

const args = process.argv.slice(2);
const forceStrict = args.includes('--strict');
const only = args.includes('--objective') ? args[args.indexOf('--objective') + 1] : undefined;
const strictList: string[] = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/strict-objectives.json'), 'utf8'));

const errors: string[] = [];
const warns: string[] = [];
const err = (m: string) => errors.push(m);

// ------------------------------------------------------- blueprint itself --
const total = DOMAINS.reduce((s, d) => s + d.weight, 0);
if (Math.abs(total - 100) > 0.15) err(`domain weights sum to ${total}`);
if (OBJECTIVES.length !== 25) err(`${OBJECTIVES.length} objectives, expected 25`);
const comp = Object.values(MOCK_COMPOSITION).reduce((s, x) => s + x, 0);
if (comp !== 53) err(`mock_composition sums to ${comp}, expected 53`);
for (const d of DOMAINS) {
  const s = d.objectives.reduce((a, o) => a + o.weight, 0);
  if (Math.abs(s - d.weight) > 0.15) err(`D${d.n} objectives sum to ${s.toFixed(1)}, domain weight ${d.weight}`);
}
const ssSeen = new Set<string>();
for (const o of OBJECTIVES) {
  if (!o.guide) err(`${o.id}: blueprint has no guide text`);
  if (!o.subskills.length) err(`${o.id}: blueprint has no subskills`);
  for (const s of o.subskills) {
    if (ssSeen.has(s.id)) err(`duplicate subskill id ${s.id}`);
    ssSeen.add(s.id);
  }
}

// ------------------------------------------------------------- per page --
export const targetWords = (w: number) => Math.round(Math.max(1200, w * 600) / 50) * 50;
const REQUIRED = ['Concept', 'Mechanism', 'Decision table', 'Worked walkthrough', 'Code', 'Recall checks'];
const FORBIDDEN_H2 = [/^named traps/i, /^what this objective/i];

function proseWords(body: string): number {
  const text = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^\|.*\|$/gm, ' ')
    .replace(/<(Flow|Sequence)[\s\S]*?\/>/g, ' ')
    .replace(/<\/?[A-Za-z][^>]*>/g, ' ')
    .replace(/`[^`]*`/g, ' x ')
    .replace(/[#>*_\-|]/g, ' ');
  return text.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
}

const rows: { id: string; strict: boolean; words: number; target: number; problems: number }[] = [];
const pages = readObjectives();
const ids = new Set(pages.map((p) => p.fm.id));
for (const o of OBJECTIVES) if (!ids.has(o.id)) err(`missing MDX for objective ${o.id}`);

for (const { file, fm, body } of pages) {
  if (only && fm.id !== only) continue;
  const bp = OBJECTIVE_BY_ID.get(fm.id);
  const local: string[] = [];
  const fail = (m: string) => local.push(`${fm.id}: ${m}`);
  if (!bp) {
    err(`${file}: id "${fm.id}" not in blueprint`);
    continue;
  }
  if (file !== `${fm.id}.mdx`) fail(`filename ${file} does not match id`);
  if (fm.name !== bp.name) fail(`name "${fm.name}" != "${bp.name}"`);
  if (fm.domain !== bp.domain) fail(`domain ${fm.domain} != ${bp.domain}`);
  if (fm.weight !== bp.weight) fail(`weight ${fm.weight} != ${bp.weight}`);
  const blocking = [...local];
  local.length = 0;

  const strict = forceStrict || strictList.includes(fm.id);
  const words = proseWords(body);
  const target = targetWords(bp.weight);

  // v2 frontmatter
  if (!fm.summary) fail('frontmatter: missing summary');
  const ss = (fm.subskills as string[] | undefined) ?? [];
  const want = bp.subskills.map((s) => s.id);
  if (ss.join() !== want.join()) fail(`frontmatter subskills must equal blueprint order: ${want.join(', ')}`);
  const related = (fm.related as string[] | undefined) ?? [];
  if (related.length < 3) fail('frontmatter: need 3+ related objective ids');
  for (const r of related) if (!OBJECTIVE_BY_ID.has(r)) fail(`related: unknown id ${r}`);
  const traps = (fm.traps as unknown[]) ?? [];
  const structured = traps.filter((t) => t && typeof t === 'object' && 'failsBecause' in (t as object));
  if (structured.length < 4 || structured.length !== traps.length) fail(`traps: need 4+ structured traps (have ${structured.length}/${traps.length})`);
  const sources = (fm.sources as { url: string; verified?: string }[]) ?? [];
  if (sources.length < 3) fail(`sources: need 3+ (have ${sources.length})`);
  if (sources.some((s) => !s.verified)) fail('sources: every source needs a verified date');
  if (!fm.lastReviewed) fail('frontmatter: missing lastReviewed');

  // body structure
  const h2 = [...body.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim());
  for (const h of h2) if (FORBIDDEN_H2.some((r) => r.test(h))) fail(`body: remove section "## ${h}" (rendered from frontmatter)`);
  let cursor = -1;
  for (const r of REQUIRED) {
    const i = h2.findIndex((h) => h.toLowerCase().startsWith(r.toLowerCase()));
    if (i < 0) fail(`body: missing "## ${r}"`);
    else if (i < cursor) fail(`body: "## ${r}" is out of order`);
    else cursor = i;
  }
  for (const id of want) {
    const n = body.split(`<SubskillAnchor id="${id}"`).length - 1;
    if (n !== 1) fail(`body: SubskillAnchor ${id} appears ${n} times (need 1)`);
  }
  const recalls = (body.match(/<Recall\s/g) ?? []).length;
  if (recalls < 5) fail(`body: ${recalls} Recall checks (need 5+)`);
  if (!/<(Flow|Sequence)\s/.test(body)) fail('body: no <Flow> or <Sequence> diagram');
  const walks = (body.match(/<Walkthrough\s/g) ?? []).length;
  const steps = (body.match(/<Step\s/g) ?? []).length;
  if (walks < 1 || steps < 4) fail(`body: need a Walkthrough with 4+ Steps (have ${walks} / ${steps})`);
  const links = (body.match(/<ObjLink\s/g) ?? []).length;
  if (links < 3) fail(`body: ${links} ObjLinks (need 3+)`);
  const decision = /## Decision table[\s\S]*?\n((?:\|.*\|\n)+)/.exec(body + '\n');
  const decisionRows = decision ? decision[1].trim().split('\n').length - 2 : 0;
  if (decisionRows < 6) fail(`body: decision table has ${decisionRows} rows (need 6+)`);
  if (/[—–]/.test(body.replace(/```[\s\S]*?```/g, '')) || /[—–]/.test(JSON.stringify(fm))) fail('style: em or en dashes (user rule: none)');
  if (words < target * 0.9) fail(`length: ${words} prose words, target ${target}`);

  for (const m of blocking) err(m);
  for (const m of local) (strict ? errors : warns).push(m);
  rows.push({ id: fm.id, strict, words, target, problems: local.length });
}

console.log('objective'.padEnd(38), 'strict', 'words'.padStart(6), 'target'.padStart(7), 'issues'.padStart(7));
for (const r of rows.sort((a, b) => (OBJECTIVE_BY_ID.get(b.id)!.weight - OBJECTIVE_BY_ID.get(a.id)!.weight)))
  console.log(r.id.padEnd(38), (r.strict ? 'yes' : '-').padEnd(6), String(r.words).padStart(6), String(r.target).padStart(7), String(r.problems).padStart(7));
console.log(`\n${rows.filter((r) => r.problems === 0).length}/${rows.length} objectives meet the v2 structure; ${warns.length} warnings`);
if (only) for (const w of warns) console.log('  ! ' + w);
if (errors.length) {
  console.error(`\nFAIL (${errors.length}):\n  ` + errors.join('\n  '));
  process.exit(1);
}
console.log('PASS: blueprint gate');
