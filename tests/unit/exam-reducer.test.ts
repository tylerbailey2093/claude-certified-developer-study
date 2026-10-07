import { describe, expect, it } from 'vitest';
import { allQuestions } from '../../src/lib/bank/bank';
import { drawExam, optionOrder } from '../../src/lib/bank/sampler';
import { mulberry32 } from '../../src/lib/bank/shuffle';
import { createSession, examReducer, remainingMs, toRecord, type ExamSession } from '../../src/lib/store/exam';

function session(now = 1_000_000): ExamSession {
  const rng = mulberry32(42);
  const items = drawExam(allQuestions(), { rng });
  const order = Object.fromEntries(items.map((q) => [q.id, optionOrder(q, rng)]));
  return createSession('strict', items, order, 42, now);
}

describe('exam reducer', () => {
  it('timeout grades the answers present at expiry, not an empty sheet (v1 regression)', () => {
    let s = session();
    const [q1, q2, q3] = s.items;
    s = examReducer(s, { type: 'ANSWER', qid: q1.id, choice: q1.answer, now: 1_000_100 });
    s = examReducer(s, { type: 'ANSWER', qid: q2.id, choice: q2.answer, now: 1_000_200 });
    const wrong = q3.options.map((o) => o.id).filter((id) => !q3.answer.includes(id)).slice(0, q3.select);
    s = examReducer(s, { type: 'ANSWER', qid: q3.id, choice: wrong, now: 1_000_300 });
    s = examReducer(s, { type: 'TICK', now: s.deadline - 1 });
    expect(s.submittedAt).toBeUndefined();
    s = examReducer(s, { type: 'TICK', now: s.deadline + 5000 });
    expect(s.reason).toBe('timeout');
    expect(s.submittedAt).toBe(s.deadline);
    expect(s.result?.answered).toBe(3);
    expect(s.result?.correct).toBe(2);
    expect(s.result?.perItem[q1.id]).toBe(true);
    expect(s.result?.perItem[q3.id]).toBe(false);
  });

  it('a finished exam ignores further actions', () => {
    let s = session();
    s = examReducer(s, { type: 'SUBMIT', now: 1_000_500 });
    const after = examReducer(s, { type: 'ANSWER', qid: s.items[0].id, choice: s.items[0].answer, now: 1_000_600 });
    expect(after).toBe(s);
  });

  it('pause extends the deadline by the paused duration', () => {
    let s = session(0);
    const deadline = s.deadline;
    s = examReducer(s, { type: 'PAUSE', now: 10_000 });
    expect(remainingMs(s, 999_999)).toBe(deadline - 10_000);
    s = examReducer(s, { type: 'TICK', now: deadline + 1 }); // paused: no timeout
    expect(s.submittedAt).toBeUndefined();
    s = examReducer(s, { type: 'RESUME', now: 70_000 });
    expect(s.deadline).toBe(deadline + 60_000);
  });

  it('tracks flags, answer changes and dwell time', () => {
    let s = session(0);
    const q = s.items[0];
    s = examReducer(s, { type: 'FLAG', qid: q.id });
    s = examReducer(s, { type: 'ANSWER', qid: q.id, choice: [q.options[0].id].slice(0, 1), now: 1000 });
    s = examReducer(s, { type: 'ANSWER', qid: q.id, choice: [q.options[1].id], now: 2000 });
    s = examReducer(s, { type: 'GOTO', index: 1, now: 30_000 });
    s = examReducer(s, { type: 'SUBMIT', now: 40_000 });
    const r = toRecord(s);
    expect(r.flags).toEqual([q.id]);
    expect(r.changes[q.id]).toBe(1);
    expect(r.dwell[q.id]).toBe(30_000);
    expect(r.dwell[s.items[1].id]).toBe(10_000);
  });

  it('survives a JSON round trip (reload resume)', () => {
    let s = session(0);
    s = examReducer(s, { type: 'ANSWER', qid: s.items[0].id, choice: s.items[0].answer, now: 500 });
    const restored = JSON.parse(JSON.stringify(s)) as ExamSession;
    const done = examReducer(restored, { type: 'TICK', now: restored.deadline });
    expect(done.result?.correct).toBe(1);
  });
});
