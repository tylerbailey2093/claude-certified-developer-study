// Draws questions for the exam simulator and practice sessions.
//
// Exam draws follow the blueprint at two levels: domain counts are fixed by
// mock_composition (53 total), and inside a domain each objective gets a share
// proportional to its weight. Fractional shares are resolved by seeded
// stochastic rounding, so a 1% objective appears in roughly the right fraction
// of mocks instead of always or never. Within an objective, unseen items are
// preferred and harder items are slightly over-weighted, because candidates
// report the live exam is harder than practice material.
import { DOMAINS, MOCK_COMPOSITION } from '../blueprint';
import { isExamEligible, isDrawable, type Question } from './schema';
import { shuffle, type Rng } from './shuffle';

const DIFFICULTY_WEIGHT: Record<number, number> = { 1: 0.7, 2: 1, 3: 1.3 };
export const MULTI_CAP_SHARE = 0.22;

export type DrawOptions = {
  rng: Rng;
  /** Question ids the user has already attempted; preferred less. */
  seen?: Set<string>;
};

/** Weighted sample without replacement (Efraimidis-Spirakis A-Res). */
function weightedPick<T>(items: T[], k: number, weight: (t: T) => number, rng: Rng): T[] {
  return items
    .map((t) => ({ t, key: Math.pow(rng(), 1 / Math.max(weight(t), 1e-6)) }))
    .sort((a, b) => b.key - a.key)
    .slice(0, k)
    .map((x) => x.t);
}

/** Split n slots across weights with seeded stochastic rounding. */
export function allocate(n: number, weights: number[], rng: Rng): number[] {
  const total = weights.reduce((s, w) => s + w, 0);
  const exact = weights.map((w) => (n * w) / total);
  const alloc = exact.map(Math.floor);
  let remaining = n - alloc.reduce((s, x) => s + x, 0);
  const frac = exact.map((e, i) => e - alloc[i]);
  const open = new Set(frac.map((_, i) => i));
  while (remaining > 0 && open.size > 0) {
    const ids = [...open];
    const sum = ids.reduce((s, i) => s + frac[i], 0);
    let r = rng() * (sum || ids.length);
    let chosen = ids[ids.length - 1];
    for (const i of ids) {
      r -= sum ? frac[i] : 1;
      if (r <= 0) {
        chosen = i;
        break;
      }
    }
    alloc[chosen]++;
    open.delete(chosen);
    remaining--;
  }
  return alloc;
}

export function drawExam(bank: Question[], opts: DrawOptions, total = 53): Question[] {
  const { rng, seen = new Set() } = opts;
  const eligible = bank.filter(isExamEligible);
  const multiCap = Math.round(total * MULTI_CAP_SHARE);
  let multiCount = 0;
  const picked: Question[] = [];

  const weightOf = (q: Question) => DIFFICULTY_WEIGHT[q.difficulty] * (seen.has(q.id) ? 1 : 2.5);

  // Full exam: the blueprint's fixed composition. Shorter mocks: split the
  // total across domains with the same remainder-preserving allocation, so the
  // count is exact (rounding each domain separately drifts by one or two).
  const domainCounts =
    total === 53
      ? DOMAINS.map((d) => MOCK_COMPOSITION[d.n])
      : allocate(total, DOMAINS.map((d) => MOCK_COMPOSITION[d.n]), rng);

  for (const [di, d] of DOMAINS.entries()) {
    const need = domainCounts[di];
    if (!need) continue;
    const objs = d.objectives;
    const pools = objs.map((o) => eligible.filter((q) => q.objective === o.id));
    let alloc = allocate(need, objs.map((o) => o.weight), rng);

    // Move slots from objectives whose pool is too small to ones with spare items.
    let overflow = 0;
    alloc = alloc.map((a, i) => {
      const cap = pools[i].length;
      if (a > cap) {
        overflow += a - cap;
        return cap;
      }
      return a;
    });
    while (overflow > 0) {
      const spare = alloc.map((a, i) => pools[i].length - a);
      const candidates = spare.map((s, i) => (s > 0 ? i : -1)).filter((i) => i >= 0);
      if (!candidates.length) break;
      const i = weightedPick(candidates, 1, (c) => objs[c].weight, rng)[0];
      alloc[i]++;
      overflow--;
    }

    pools.forEach((pool, i) => {
      if (!alloc[i]) return;
      const order = weightedPick(pool, pool.length, weightOf, rng);
      const chosen: Question[] = [];
      // First pass honours the multi-response cap; second pass fills any gap.
      for (const q of order) {
        if (chosen.length >= alloc[i]) break;
        if (q.type === 'multi' && multiCount >= multiCap) continue;
        chosen.push(q);
        if (q.type === 'multi') multiCount++;
      }
      for (const q of order) {
        if (chosen.length >= alloc[i]) break;
        if (!chosen.includes(q)) chosen.push(q);
      }
      picked.push(...chosen);
    });
  }
  return shuffle(picked, rng);
}

export type PracticeFilter = {
  domains?: number[];
  objectives?: string[];
  subskills?: string[];
  type?: 'single' | 'multi';
  difficulty?: number[];
  ids?: string[];
  unseenOnly?: boolean;
};

export function filterBank(bank: Question[], f: PracticeFilter, seen: Set<string> = new Set()): Question[] {
  return bank.filter(
    (q) =>
      isDrawable(q) &&
      (!f.domains?.length || f.domains.includes(q.domain)) &&
      (!f.objectives?.length || f.objectives.includes(q.objective)) &&
      (!f.subskills?.length || q.subskills.some((s) => f.subskills!.includes(s))) &&
      (!f.type || q.type === f.type) &&
      (!f.difficulty?.length || f.difficulty.includes(q.difficulty)) &&
      (!f.ids?.length || f.ids.includes(q.id)) &&
      (!f.unseenOnly || !seen.has(q.id))
  );
}

/** Exam-weighted practice set: objectives drawn in proportion to blueprint weight. */
export function drawWeighted(bank: Question[], n: number, opts: DrawOptions): Question[] {
  const { rng, seen = new Set() } = opts;
  const pool = bank.filter(isDrawable);
  const objWeight = new Map(DOMAINS.flatMap((d) => d.objectives.map((o) => [o.id, o.weight] as const)));
  const counts = new Map<string, number>();
  for (const q of pool) counts.set(q.objective, (counts.get(q.objective) ?? 0) + 1);
  // Per-item weight = objective weight / items in that objective, so each
  // objective's total draw probability tracks its exam weight.
  return weightedPick(
    pool,
    Math.min(n, pool.length),
    (q) => ((objWeight.get(q.objective) ?? 1) / (counts.get(q.objective) ?? 1)) * (seen.has(q.id) ? 1 : 2),
    rng
  );
}

/** Display order for one question's options. */
export function optionOrder(q: Question, rng: Rng): string[] {
  return shuffle(
    q.options.map((o) => o.id),
    rng
  );
}
