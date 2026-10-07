// Shared loaders for gate scripts (Node, no Vite). Mirrors src/lib/bank/bank.ts.
import fs from 'node:fs';
import path from 'node:path';
import { QuestionSchema, type Question } from '../../src/lib/bank/schema.ts';

export const ROOT = path.resolve(import.meta.dirname, '../..');
export const QDIR = path.join(ROOT, 'src/data/questions');
export const ODIR = path.join(ROOT, 'src/content/objectives');

export type LoadedQuestion = Question & { _file: string };

/** Parse every bank file. Throws with file + item context on schema errors. */
export function loadBank(opts: { includeRetired?: boolean } = {}): LoadedQuestion[] {
  const out: LoadedQuestion[] = [];
  for (const f of fs.readdirSync(QDIR).filter((f) => f.endsWith('.json')).sort()) {
    if (f === 'retired.json' && !opts.includeRetired) continue;
    const raw = JSON.parse(fs.readFileSync(path.join(QDIR, f), 'utf8')) as unknown[];
    raw.forEach((item, i) => {
      const r = QuestionSchema.safeParse(item);
      if (!r.success) {
        const id = (item as { id?: string })?.id ?? `#${i}`;
        throw new Error(`${f} ${id}: ${r.error.issues.map((x) => `${x.path.join('.')}: ${x.message}`).join('; ')}`);
      }
      out.push({ ...r.data, _file: f });
    });
  }
  return out;
}

export type Frontmatter = Record<string, unknown> & { id: string; name: string; domain: number; weight: number };

/** Minimal YAML-frontmatter reader for our MDX files (flat keys, lists, list-of-maps). */
export function readObjectives(): { file: string; fm: Frontmatter; body: string }[] {
  // Lazy import keeps scripts that don't need YAML fast.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return fs
    .readdirSync(ODIR)
    .filter((f) => f.endsWith('.mdx'))
    .sort()
    .map((file) => {
      const src = fs.readFileSync(path.join(ODIR, file), 'utf8');
      const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(src);
      if (!m) throw new Error(`${file}: missing frontmatter`);
      return { file, fm: parseYaml(m[1]) as Frontmatter, body: m[2] };
    });
}

import { parse as parseYaml } from 'yaml';
