// localStorage persistence layer, namespaced and versioned so a schema change
// doesn't collide with stale data from a prior build.
const NS = 'ccdvf:v1:';

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

export function get<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  return safeParse(window.localStorage.getItem(NS + key), fallback);
}

export function set<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(NS + key, JSON.stringify(value));
}

export type MissRecord = {
  questionId: string;
  objective: string;
  domain: number;
  missedAt: number;      // epoch ms
  dueAt: number;          // epoch ms — next SRS review
  streak: number;         // consecutive correct reviews since last miss
};

export type MockResult = {
  id: string;
  takenAt: number;
  scorePct: number;
  scaledEstimate: number;
  byDomain: Record<number, { correct: number; total: number }>;
};

export type Confidence = Record<string, number>; // objective name -> 1..5

const KEYS = {
  misses: 'misses',
  mockHistory: 'mockHistory',
  confidence: 'confidence',
  checklist: 'checklist',
};

export const Store = {
  getMisses: () => get<MissRecord[]>(KEYS.misses, []),
  setMisses: (v: MissRecord[]) => set(KEYS.misses, v),

  recordMiss(questionId: string, objective: string, domain: number) {
    const misses = Store.getMisses();
    const now = Date.now();
    const existing = misses.find((m) => m.questionId === questionId);
    const dueAt = now + 24 * 60 * 60 * 1000; // 1 day
    if (existing) {
      existing.missedAt = now;
      existing.dueAt = dueAt;
      existing.streak = 0;
    } else {
      misses.push({ questionId, objective, domain, missedAt: now, dueAt, streak: 0 });
    }
    Store.setMisses(misses);
  },

  recordReviewCorrect(questionId: string) {
    const misses = Store.getMisses();
    const m = misses.find((x) => x.questionId === questionId);
    if (!m) return;
    // SRS ladder: 1 day -> 3 days -> 7 days -> graduated (removed from queue)
    const ladder = [1, 3, 7];
    const next = ladder[Math.min(m.streak, ladder.length - 1)];
    m.streak += 1;
    if (m.streak > ladder.length) {
      Store.setMisses(misses.filter((x) => x.questionId !== questionId));
      return;
    }
    m.dueAt = Date.now() + next * 24 * 60 * 60 * 1000;
    Store.setMisses(misses);
  },

  dueForReview(): MissRecord[] {
    const now = Date.now();
    return Store.getMisses().filter((m) => m.dueAt <= now);
  },

  getMockHistory: () => get<MockResult[]>(KEYS.mockHistory, []),
  addMockResult(r: MockResult) {
    const hist = Store.getMockHistory();
    hist.push(r);
    set(KEYS.mockHistory, hist);
  },

  getConfidence: () => get<Confidence>(KEYS.confidence, {}),
  setConfidenceFor(objective: string, rating: number) {
    const c = Store.getConfidence();
    c[objective] = rating;
    set(KEYS.confidence, c);
  },

  getChecklist: () => get<Record<string, boolean>>(KEYS.checklist, {}),
  setChecklistItem(id: string, done: boolean) {
    const c = Store.getChecklist();
    c[id] = done;
    set(KEYS.checklist, c);
  },

  weakestObjectives(limit = 5): { objective: string; misses: number }[] {
    const misses = Store.getMisses();
    const counts = new Map<string, number>();
    for (const m of misses) counts.set(m.objective, (counts.get(m.objective) ?? 0) + 1);
    return [...counts.entries()]
      .map(([objective, misses]) => ({ objective, misses }))
      .sort((a, b) => b.misses - a.misses)
      .slice(0, limit);
  },

  exportJSON(): string {
    return JSON.stringify({
      version: 1,
      exportedAt: Date.now(),
      misses: Store.getMisses(),
      mockHistory: Store.getMockHistory(),
      confidence: Store.getConfidence(),
      checklist: Store.getChecklist(),
    }, null, 2);
  },

  importJSON(json: string): void {
    const data = JSON.parse(json);
    if (data.misses) Store.setMisses(data.misses);
    if (data.mockHistory) set(KEYS.mockHistory, data.mockHistory);
    if (data.confidence) set(KEYS.confidence, data.confidence);
    if (data.checklist) set(KEYS.checklist, data.checklist);
  },
};
