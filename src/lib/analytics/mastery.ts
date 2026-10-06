// Mastery and readiness estimates from the attempt log.
//
// Mastery per objective is a smoothed accuracy: a Beta(1,1) prior updated by
// attempts weighted for recency (half-life 14 days), difficulty, and source
// (exam attempts count more, because they are taken under exam conditions).
// Readiness combines mastery with coverage across each objective's items and
// weights by the blueprint. It is an estimate for steering study time, not a
// prediction of the scaled score; the real scaling is not published.
import { OBJECTIVES } from '../blueprint';
import type { Attempt } from '../store/schema';

export const HALF_LIFE_DAYS = 14;
const DAY = 86400000;
const DIFF_FACTOR: Record<number, number> = { 1: 0.8, 2: 1, 3: 1.25 };

export type ObjectiveMastery = {
  objective: string;
  weight: number;
  attempts: number;
  recentCorrect: number;
  accuracy: number | null; // raw, unweighted
  mastery: number; // 0..1 smoothed
  coverage: number; // 0..1
};

export type Readiness = {
  score: number; // 0..1
  scaledEstimate: number;
  band: [number, number];
  sufficient: boolean;
  reason?: string;
  objectives: ObjectiveMastery[];
};

export function objectiveMastery(
  attempts: Attempt[],
  poolSizes: Record<string, number>,
  now = Date.now()
): ObjectiveMastery[] {
  return OBJECTIVES.map((o) => {
    const mine = attempts.filter((a) => a.o === o.id);
    let w = 0;
    let wc = 0;
    for (const a of mine) {
      const age = Math.max(0, now - a.t) / DAY;
      const weight = Math.pow(0.5, age / HALF_LIFE_DAYS) * (DIFF_FACTOR[a.diff ?? 2] ?? 1) * (a.src === 'exam' ? 1.5 : 1);
      w += weight;
      wc += weight * a.ok;
    }
    const correctRecent = new Set(mine.filter((a) => a.ok && now - a.t < 30 * DAY).map((a) => a.q));
    const pool = poolSizes[o.id] ?? 0;
    const coverageTarget = Math.max(1, Math.min(8, pool));
    return {
      objective: o.id,
      weight: o.weight,
      attempts: mine.length,
      recentCorrect: correctRecent.size,
      accuracy: mine.length ? mine.reduce((s, a) => s + a.ok, 0) / mine.length : null,
      mastery: (1 + wc) / (2 + w),
      coverage: Math.min(1, correctRecent.size / coverageTarget),
    };
  });
}

export function readiness(attempts: Attempt[], poolSizes: Record<string, number>, now = Date.now()): Readiness {
  const objectives = objectiveMastery(attempts, poolSizes, now);
  const total = objectives.reduce((s, o) => s + o.weight, 0);
  const score = objectives.reduce((s, o) => s + o.weight * o.mastery * (0.7 + 0.3 * o.coverage), 0) / total;
  const n = attempts.length;
  const thin = objectives.filter((o) => o.weight >= 4 && o.attempts < 5);
  const sufficient = n >= 60 && thin.length === 0;
  // Band narrows with evidence: roughly +/- one binomial standard error on 53 items.
  const se = Math.sqrt(Math.max(score * (1 - score), 0.05) / Math.max(10, Math.min(n, 200)));
  const scaledOf = (p: number) => Math.round(100 + 900 * Math.min(1, Math.max(0, p)));
  return {
    score,
    scaledEstimate: scaledOf(score),
    band: [scaledOf(score - 1.5 * se), scaledOf(score + 1.5 * se)],
    sufficient,
    reason: sufficient
      ? undefined
      : n < 60
        ? `${60 - n} more answers needed for a stable estimate`
        : `Not enough answers yet on: ${thin.map((o) => o.objective).join(', ')}`,
    objectives,
  };
}

/** Rank objectives for "next up": heavy, weak, and due first. */
export function nextUp(
  m: ObjectiveMastery[],
  dueByObjective: Record<string, number>,
  limit = 3
): ObjectiveMastery[] {
  return [...m]
    .sort(
      (a, b) =>
        b.weight * (1 - b.mastery) + (dueByObjective[b.objective] ?? 0) * 0.3 -
        (a.weight * (1 - a.mastery) + (dueByObjective[a.objective] ?? 0) * 0.3)
    )
    .slice(0, limit);
}
