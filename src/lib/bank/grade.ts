// Pure grading. Takes the questions and the answers as they exist at the
// moment of grading; never closes over UI state.
import { DOMAINS } from '../blueprint';
import { isCorrect, type Question } from './schema';

export type DomainScore = { domain: number; correct: number; total: number };
export type ObjectiveScore = { objective: string; correct: number; total: number };

export type GradeResult = {
  correct: number;
  total: number;
  answered: number;
  pct: number;
  /** Linear estimate on the 100-1000 scale. The real exam's scaling is not published. */
  scaledEstimate: number;
  passEstimate: boolean;
  byDomain: DomainScore[];
  byObjective: ObjectiveScore[];
  perItem: Record<string, boolean>;
};

export function scaled(pct: number): number {
  return Math.round(100 + 900 * pct);
}

export function grade(items: Question[], answers: Record<string, string[]>): GradeResult {
  const perItem: Record<string, boolean> = {};
  const dom = new Map<number, DomainScore>();
  const obj = new Map<string, ObjectiveScore>();
  let correct = 0;
  let answered = 0;
  for (const q of items) {
    const chosen = answers[q.id] ?? [];
    if (chosen.length) answered++;
    const ok = isCorrect(q, chosen);
    perItem[q.id] = ok;
    if (ok) correct++;
    const d = dom.get(q.domain) ?? { domain: q.domain, correct: 0, total: 0 };
    d.total++;
    if (ok) d.correct++;
    dom.set(q.domain, d);
    const o = obj.get(q.objective) ?? { objective: q.objective, correct: 0, total: 0 };
    o.total++;
    if (ok) o.correct++;
    obj.set(q.objective, o);
  }
  const total = items.length;
  const pct = total ? correct / total : 0;
  const s = scaled(pct);
  return {
    correct,
    total,
    answered,
    pct,
    scaledEstimate: s,
    passEstimate: s >= 720,
    byDomain: DOMAINS.map((d) => dom.get(d.n)).filter((x): x is DomainScore => !!x),
    byObjective: [...obj.values()].sort((a, b) => a.objective.localeCompare(b.objective)),
    perItem,
  };
}
