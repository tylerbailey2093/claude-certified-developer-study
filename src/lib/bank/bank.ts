// Build-time access to the question bank. Used by Astro pages and the
// /data/bank.json endpoint. Islands never import this (it would inline ~1 MB
// of JSON into page bundles); they fetch the endpoint via load.ts instead.
import { QuestionSchema, type Question } from './schema';

const modules = import.meta.glob<{ default: unknown[] }>('../../data/questions/*.json', { eager: true });

let cache: Question[] | null = null;

export function allQuestions(): Question[] {
  if (cache) return cache;
  const out: Question[] = [];
  for (const [file, mod] of Object.entries(modules)) {
    if (file.endsWith('/retired.json')) continue;
    for (const raw of mod.default) out.push(QuestionSchema.parse(raw));
  }
  out.sort((a, b) => a.id.localeCompare(b.id));
  cache = out;
  return out;
}

export function questionsFor(objectiveId: string): Question[] {
  return allQuestions().filter((q) => q.objective === objectiveId && q.status !== 'retired');
}
