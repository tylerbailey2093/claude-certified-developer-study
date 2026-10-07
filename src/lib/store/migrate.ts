// v1 -> v2 migration. Runs once per browser (meta.migratedFromV1 marks it),
// is idempotent, and leaves the v1 keys in place so a rollback still works.
// The same mapping imports v1 export files.
import { OBJECTIVES } from '../blueprint';
import { V1_CHECKLIST_MAP } from './v1-checklist-map';
import { DAY } from './srs';
import type { Attempt, StoreShape } from './schema';
import type { Deck } from './srs';
import type { ExamRecord } from './exam';

type V1Miss = { questionId: string; objective: string; domain: number; missedAt: number; dueAt: number; streak: number };
type V1Mock = {
  id: string;
  takenAt: number;
  scorePct: number;
  scaledEstimate: number;
  byDomain: Record<string, { correct: number; total: number }>;
};
export type V1Data = {
  misses?: V1Miss[];
  mockHistory?: V1Mock[];
  confidence?: Record<string, number>;
  checklist?: Record<string, boolean>;
  theme?: string;
};

const ID_BY_NAME = new Map(OBJECTIVES.map((o) => [o.name, o.id]));

export function objectiveIdFor(nameOrId: string): string {
  return ID_BY_NAME.get(nameOrId) ?? nameOrId;
}

/** Pure: map v1 data into v2 partial state. */
export function mapV1(v1: V1Data, now: number): Partial<StoreShape> {
  const srs: Deck = {};
  const attempts: Attempt[] = [];
  for (const m of v1.misses ?? []) {
    if (!m || typeof m.questionId !== 'string') continue;
    srs[m.questionId] = {
      box: Math.min(5, 1 + Math.max(0, m.streak | 0)),
      due: Number.isFinite(m.dueAt) ? m.dueAt : now + DAY,
      lapses: 1,
      last: m.missedAt || now,
    };
    attempts.push({
      q: m.questionId,
      o: objectiveIdFor(m.objective),
      d: m.domain,
      ok: 0,
      t: m.missedAt || now,
      src: 'v1',
    });
  }

  const confidence: Record<string, number> = {};
  for (const [k, v] of Object.entries(v1.confidence ?? {})) {
    if (typeof v === 'number' && v >= 1 && v <= 5) confidence[objectiveIdFor(k)] = v;
  }

  const checklist: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(v1.checklist ?? {})) {
    const id = V1_CHECKLIST_MAP[k] ?? k;
    if (v) checklist[id] = true;
  }

  const history: ExamRecord[] = (v1.mockHistory ?? []).map((m) => {
    const byDomain = Object.entries(m.byDomain ?? {}).map(([d, s]) => ({
      domain: Number(d),
      correct: s.correct,
      total: s.total,
    }));
    const correct = byDomain.reduce((s, d) => s + d.correct, 0);
    const total = byDomain.reduce((s, d) => s + d.total, 0);
    return {
      id: m.id,
      mode: 'legacy',
      takenAt: m.takenAt,
      submittedAt: m.takenAt,
      reason: 'legacy',
      usedMs: 0,
      correct,
      total,
      answered: total,
      scaledEstimate: m.scaledEstimate,
      byDomain,
      byObjective: [],
      items: [],
      answers: {},
      order: {},
      perItem: {},
      flags: [],
      dwell: {},
      changes: {},
    };
  });

  const out: Partial<StoreShape> = { srs, attempts, confidence, checklist, 'exam:history': history };
  if (v1.theme === 'dark' || v1.theme === 'light') out.prefs = { theme: v1.theme };
  return out;
}

/** Merge mapped v1 data into existing v2 state without clobbering newer data. */
export function mergeInto(cur: StoreShape, add: Partial<StoreShape>): StoreShape {
  const seenAttempts = new Set(cur.attempts.map((a) => `${a.q}|${a.t}|${a.src}`));
  const histIds = new Set(cur['exam:history'].map((h) => h.id));
  return {
    ...cur,
    srs: { ...(add.srs ?? {}), ...cur.srs },
    attempts: [
      ...(add.attempts ?? []).filter((a) => !seenAttempts.has(`${a.q}|${a.t}|${a.src}`)),
      ...cur.attempts,
    ].sort((a, b) => a.t - b.t),
    confidence: { ...(add.confidence ?? {}), ...cur.confidence },
    checklist: { ...(add.checklist ?? {}), ...cur.checklist },
    prefs: { ...(add.prefs ?? {}), ...cur.prefs },
    'exam:history': [...(add['exam:history'] ?? []).filter((h) => !histIds.has(h.id)), ...cur['exam:history']].sort(
      (a, b) => a.takenAt - b.takenAt
    ),
  };
}
