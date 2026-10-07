// One-shot migration: src/data/questions/all.json (v1) -> one v2 file per
// objective (src/data/questions/<objective-id>.json) plus retired.json.
//
// v1 item: { id, d, s (objective NAME), q, o[4], a (index | index[]), e, pattern }
// v2 item: see src/lib/bank/schema.ts. Option ids are a-d in the ORIGINAL order,
// so an explanation that still says "option B" can be repaired mechanically by
// a later pass. Items without per-option rationales get status needs-rationale.
//
// Idempotent: refuses to run if all.json is already gone.
import fs from 'node:fs';
import path from 'node:path';
import { QuestionSchema, type Question } from '../src/lib/bank/schema.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const QDIR = path.join(ROOT, 'src/data/questions');
const ALL = path.join(QDIR, 'all.json');

// Retired on migration, with the reason recorded in the item.
const RETIRE: Record<string, string> = {
  'new-llm-fundamentals-02':
    'Meta-item about blueprint placement that encoded a wrong claim (few-shot is NOT D5-only; guide p7 lists few-shot examples under D6 Prompt Engineering).',
};

type V1 = { id: string; d: number; s: string; q: string; o: string[]; a: number | number[]; e: string; pattern: string };

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function objectiveIds(): Map<string, string> {
  const dir = path.join(ROOT, 'src/content/objectives');
  const map = new Map<string, string>();
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.mdx'))) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    const id = /^id:\s*"?([^"\n]+)"?/m.exec(src)?.[1];
    const name = /^name:\s*"?([^"\n]+)"?/m.exec(src)?.[1];
    if (id && name) map.set(name, id);
  }
  return map;
}

function main() {
  if (!fs.existsSync(ALL)) {
    console.log('all.json not found: migration already applied, nothing to do.');
    return;
  }
  const v1 = JSON.parse(fs.readFileSync(ALL, 'utf8')) as V1[];
  const ids = objectiveIds();
  const byObjective = new Map<string, Question[]>();
  const retired: Question[] = [];
  const report = { total: v1.length, migrated: 0, retired: 0, multi: 0, byObjective: {} as Record<string, number> };

  for (const q of v1) {
    const objective = ids.get(q.s) ?? slug(q.s);
    const answers = (Array.isArray(q.a) ? q.a : [q.a]).map((i) => 'abcdef'[i]);
    const multi = answers.length > 1;
    const item = QuestionSchema.parse({
      id: q.id,
      objective,
      domain: q.d,
      subskills: [],
      type: multi ? 'multi' : 'single',
      select: answers.length,
      stem: q.q,
      options: q.o.map((text, i) => ({ id: 'abcdef'[i], text, why: '' })),
      answer: answers,
      explanation: q.e,
      cue: '',
      pattern: q.pattern,
      difficulty: 2,
      author: q.id.startsWith('legacy-') ? 'legacy' : 'v1-new',
      status: RETIRE[q.id] ? 'retired' : 'needs-rationale',
      ...(RETIRE[q.id] ? { tags: ['retired:' + RETIRE[q.id]] } : {}),
    });
    if (multi) report.multi++;
    if (item.status === 'retired') {
      retired.push(item);
      report.retired++;
      continue;
    }
    if (!byObjective.has(objective)) byObjective.set(objective, []);
    byObjective.get(objective)!.push(item);
    report.migrated++;
  }

  for (const [obj, items] of [...byObjective.entries()].sort()) {
    fs.writeFileSync(path.join(QDIR, `${obj}.json`), JSON.stringify(items, null, 2) + '\n');
    report.byObjective[obj] = items.length;
  }
  fs.writeFileSync(path.join(QDIR, 'retired.json'), JSON.stringify(retired, null, 2) + '\n');

  // Remove the v1 artefacts only after every v2 file is written.
  fs.rmSync(ALL);
  for (let d = 1; d <= 8; d++) fs.rmSync(path.join(QDIR, `d${d}.json`), { force: true });
  fs.rmSync(path.join(QDIR, 'new'), { recursive: true, force: true });

  console.log(JSON.stringify(report, null, 2));
}

main();
