// Exam simulator state as a pure reducer.
//
// The v1 mock had a stale-closure bug: its timer captured submit() from the
// first render, so a timeout graded an empty answer sheet. Here the timer only
// dispatches TICK; the reducer grades from the state that exists at that
// moment. The deadline is an absolute timestamp, so a reload or an app kill
// resumes with the correct remaining time, and the drawn items are
// snapshotted into the session so a bank update cannot break a resumed exam.
import { grade, type GradeResult } from '../bank/grade';
import type { Question } from '../bank/schema';

export type ExamMode = 'strict' | 'practice' | 'mini';

export const MODE_CONFIG: Record<ExamMode, { items: number; minutes: number; pausable: boolean; label: string }> = {
  strict: { items: 53, minutes: 120, pausable: false, label: 'Full exam (strict)' },
  practice: { items: 53, minutes: 120, pausable: true, label: 'Full exam (pausable)' },
  mini: { items: 20, minutes: 45, pausable: true, label: 'Mini mock' },
};

export type Visit = [enter: number, leave?: number];

export type ExamSession = {
  id: string;
  mode: ExamMode;
  seed: number;
  startedAt: number;
  durationMs: number;
  deadline: number;
  pausedAt?: number;
  submittedAt?: number;
  reason?: 'submit' | 'timeout';
  items: Question[];
  order: Record<string, string[]>;
  answers: Record<string, string[]>;
  flags: Record<string, true>;
  struck: Record<string, string[]>;
  visits: Record<string, Visit[]>;
  changes: Record<string, number>;
  cursor: number;
  view: 'question' | 'review';
  warned5?: boolean;
  result?: GradeResult;
};

export type ExamAction =
  | { type: 'ANSWER'; qid: string; choice: string[]; now: number }
  | { type: 'STRIKE'; qid: string; option: string }
  | { type: 'FLAG'; qid: string }
  | { type: 'GOTO'; index: number; now: number }
  | { type: 'VIEW'; view: 'question' | 'review'; now: number }
  | { type: 'PAUSE'; now: number }
  | { type: 'RESUME'; now: number }
  | { type: 'TICK'; now: number }
  | { type: 'WARNED' }
  | { type: 'SUBMIT'; now: number };

export function createSession(
  mode: ExamMode,
  items: Question[],
  order: Record<string, string[]>,
  seed: number,
  now: number
): ExamSession {
  const durationMs = MODE_CONFIG[mode].minutes * 60 * 1000;
  const first = items[0]?.id;
  return {
    id: `exam-${now}-${seed}`,
    mode,
    seed,
    startedAt: now,
    durationMs,
    deadline: now + durationMs,
    items,
    order,
    answers: {},
    flags: {},
    struck: {},
    visits: first ? { [first]: [[now]] } : {},
    changes: {},
    cursor: 0,
    view: 'question',
  };
}

export function remainingMs(s: ExamSession, now: number): number {
  if (s.submittedAt) return Math.max(0, s.deadline - s.submittedAt);
  if (s.pausedAt) return Math.max(0, s.deadline - s.pausedAt);
  return Math.max(0, s.deadline - now);
}

function closeVisit(s: ExamSession, now: number): Record<string, Visit[]> {
  const q = s.items[s.cursor];
  if (!q || s.view !== 'question') return s.visits;
  const list = s.visits[q.id] ?? [];
  const last = list[list.length - 1];
  if (!last || last[1] !== undefined) return s.visits;
  return { ...s.visits, [q.id]: [...list.slice(0, -1), [last[0], now]] };
}

function openVisit(visits: Record<string, Visit[]>, qid: string | undefined, now: number) {
  if (!qid) return visits;
  return { ...visits, [qid]: [...(visits[qid] ?? []), [now] as Visit] };
}

function finish(s: ExamSession, now: number, reason: 'submit' | 'timeout'): ExamSession {
  const at = reason === 'timeout' ? Math.min(now, s.deadline) : now;
  const visits = closeVisit(s, at);
  return { ...s, visits, submittedAt: at, reason, pausedAt: undefined, result: grade(s.items, s.answers) };
}

export function examReducer(s: ExamSession, a: ExamAction): ExamSession {
  if (s.submittedAt) return s; // a finished exam is immutable
  switch (a.type) {
    case 'ANSWER': {
      if (s.pausedAt) return s;
      const prev = s.answers[a.qid] ?? [];
      const changed = prev.length > 0 && prev.join() !== a.choice.join();
      return {
        ...s,
        answers: { ...s.answers, [a.qid]: a.choice },
        changes: changed ? { ...s.changes, [a.qid]: (s.changes[a.qid] ?? 0) + 1 } : s.changes,
      };
    }
    case 'STRIKE': {
      const cur = s.struck[a.qid] ?? [];
      const next = cur.includes(a.option) ? cur.filter((o) => o !== a.option) : [...cur, a.option];
      return { ...s, struck: { ...s.struck, [a.qid]: next } };
    }
    case 'FLAG': {
      const flags = { ...s.flags };
      if (flags[a.qid]) delete flags[a.qid];
      else flags[a.qid] = true;
      return { ...s, flags };
    }
    case 'GOTO': {
      if (s.pausedAt) return s;
      const index = Math.max(0, Math.min(s.items.length - 1, a.index));
      const visits = openVisit(closeVisit(s, a.now), s.items[index]?.id, a.now);
      return { ...s, cursor: index, view: 'question', visits };
    }
    case 'VIEW': {
      if (a.view === s.view) return s;
      if (a.view === 'review') return { ...s, visits: closeVisit(s, a.now), view: 'review' };
      return { ...s, view: 'question', visits: openVisit(s.visits, s.items[s.cursor]?.id, a.now) };
    }
    case 'PAUSE': {
      if (s.pausedAt) return s;
      return { ...s, pausedAt: a.now, visits: closeVisit(s, a.now) };
    }
    case 'RESUME': {
      if (!s.pausedAt) return s;
      const paused = a.now - s.pausedAt;
      const visits = s.view === 'question' ? openVisit(s.visits, s.items[s.cursor]?.id, a.now) : s.visits;
      return { ...s, pausedAt: undefined, deadline: s.deadline + paused, visits };
    }
    case 'TICK': {
      if (s.pausedAt) return s;
      return a.now >= s.deadline ? finish(s, a.now, 'timeout') : s;
    }
    case 'WARNED':
      return { ...s, warned5: true };
    case 'SUBMIT':
      return finish(s, a.now, 'submit');
  }
}

/** Total milliseconds spent on each item, from closed visits. */
export function dwellTimes(s: ExamSession): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [qid, visits] of Object.entries(s.visits)) {
    out[qid] = visits.reduce((sum, [enter, leave]) => sum + (leave !== undefined ? leave - enter : 0), 0);
  }
  return out;
}

/** Compact record kept in history after an exam ends. */
export type ExamRecord = {
  id: string;
  mode: ExamMode | 'legacy';
  takenAt: number;
  submittedAt: number;
  reason: 'submit' | 'timeout' | 'legacy';
  usedMs: number;
  correct: number;
  total: number;
  answered: number;
  scaledEstimate: number;
  byDomain: { domain: number; correct: number; total: number }[];
  byObjective: { objective: string; correct: number; total: number }[];
  items: string[];
  answers: Record<string, string[]>;
  order: Record<string, string[]>;
  perItem: Record<string, boolean>;
  flags: string[];
  dwell: Record<string, number>;
  changes: Record<string, number>;
  /** Sequence of first-visit completion times, for the pacing curve. */
  firstAnsweredAt?: Record<string, number>;
};

export function toRecord(s: ExamSession): ExamRecord {
  const r = s.result ?? grade(s.items, s.answers);
  const end = s.submittedAt ?? Date.now();
  return {
    id: s.id,
    mode: s.mode,
    takenAt: s.startedAt,
    submittedAt: end,
    reason: s.reason ?? 'submit',
    usedMs: Math.min(s.durationMs, s.durationMs - (s.deadline - end)),
    correct: r.correct,
    total: r.total,
    answered: r.answered,
    scaledEstimate: r.scaledEstimate,
    byDomain: r.byDomain,
    byObjective: r.byObjective,
    items: s.items.map((q) => q.id),
    answers: s.answers,
    order: s.order,
    perItem: r.perItem,
    flags: Object.keys(s.flags),
    dwell: dwellTimes(s),
    changes: s.changes,
  };
}
