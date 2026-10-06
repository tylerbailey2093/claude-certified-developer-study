// Question-bank coverage against the blueprint.
//
//   target items per objective = max(8, round(weight x 4.5))      (about 450 total)
//   mock pool: each domain needs >= 1.5x its exam draw, so mocks vary
//   subskills: every blueprint subskill needs >= 2 tagged items (once subskills exist)
//
// Default mode fails only on the mock-pool floor (the site breaks without it)
// and reports progress toward targets. --strict also fails on targets and
// subskill coverage; CI switches to strict once the content waves land.
import { DOMAINS, MOCK_COMPOSITION, OBJECTIVES } from '../src/lib/blueprint.ts';
import { loadBank } from './lib/load.ts';
import blueprint from '../blueprint.json' with { type: 'json' };

const strict = process.argv.includes('--strict');
const bank = loadBank().filter((q) => q.status !== 'retired');
const errors: string[] = [];
const warnings: string[] = [];

export const targetFor = (weight: number) => Math.max(8, Math.round(weight * 4.5));

const rows = OBJECTIVES.map((o) => {
  const items = bank.filter((q) => q.objective === o.id);
  const target = targetFor(o.weight);
  const multi = items.filter((q) => q.type === 'multi').length;
  return { o, n: items.length, target, multi };
});

console.log('objective'.padEnd(40), 'items'.padStart(5), 'target'.padStart(7), 'multi'.padStart(6));
for (const r of [...rows].sort((a, b) => b.o.weight - a.o.weight)) {
  const flag = r.n >= r.target ? '' : `  (-${r.target - r.n})`;
  console.log(`${r.o.name.padEnd(40)} ${String(r.n).padStart(5)} ${String(r.target).padStart(7)} ${String(r.multi).padStart(6)}${flag}`);
  if (r.n < r.target) (strict ? errors : warnings).push(`${r.o.id}: ${r.n}/${r.target} items`);
}
const total = rows.reduce((s, r) => s + r.n, 0);
const totalTarget = rows.reduce((s, r) => s + r.target, 0);
console.log(`\ntotal ${total}/${totalTarget} items`);

for (const d of DOMAINS) {
  const pool = bank.filter((q) => q.domain === d.n && !q.postGuide).length;
  const need = MOCK_COMPOSITION[d.n];
  if (pool < Math.ceil(need * 1.5)) errors.push(`D${d.n}: mock pool ${pool} < 1.5 x ${need}`);
}

// Subskill coverage, once blueprint v2 defines subskills.
type BPObj = { id?: string; name: string; subskills?: { id: string }[] };
const bpObjs = (blueprint as unknown as { domains: { objectives: BPObj[] }[] }).domains.flatMap((d) => d.objectives);
const withSubskills = bpObjs.filter((o) => o.subskills?.length);
if (withSubskills.length) {
  let uncovered = 0;
  for (const o of withSubskills) {
    for (const s of o.subskills!) {
      const n = bank.filter((q) => q.subskills.includes(s.id)).length;
      if (n < 2) {
        uncovered++;
        (strict ? errors : warnings).push(`subskill ${s.id}: ${n} item(s), need 2`);
      }
    }
  }
  const all = withSubskills.reduce((s, o) => s + o.subskills!.length, 0);
  console.log(`subskills covered by 2+ items: ${all - uncovered}/${all}`);
}

const multiShare = bank.filter((q) => q.type === 'multi').length / Math.max(1, bank.length);
console.log(`multi-response share: ${(multiShare * 100).toFixed(1)}% (target 18-25%)`);
if (strict && (multiShare < 0.18 || multiShare > 0.25)) errors.push(`multi-response share ${(multiShare * 100).toFixed(1)}% outside 18-25%`);

if (warnings.length) console.log(`\n${warnings.length} warning(s) (fail under --strict). First few:\n  ` + warnings.slice(0, 6).join('\n  '));
if (errors.length) {
  console.error(`\nFAIL:\n  ${errors.join('\n  ')}`);
  process.exit(1);
}
console.log('\nPASS: coverage gate');
