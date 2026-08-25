import { useEffect, useMemo, useRef, useState } from 'react';
import allQuestions from '../data/questions/all.json';
import blueprint from '../../blueprint.json';
import { Store } from '../lib/store';

type Q = { id: string; d: number; s: string; q: string; o: string[]; a: number | number[]; e: string; pattern: string };

const MOCK_COMPOSITION: Record<string, number> = (blueprint as any).mock_composition;
const DURATION_MIN = 120;
const KEYS = ['A', 'B', 'C', 'D'];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sampleMock(): Q[] {
  const byDomain = new Map<number, Q[]>();
  for (const q of allQuestions as Q[]) {
    if (!byDomain.has(q.d)) byDomain.set(q.d, []);
    byDomain.get(q.d)!.push(q);
  }
  const picked: Q[] = [];
  for (const [dStr, count] of Object.entries(MOCK_COMPOSITION)) {
    const d = Number(dStr);
    const pool = shuffle(byDomain.get(d) ?? []);
    picked.push(...pool.slice(0, count)); // if pool < count, that domain's whole pool is used — see variance note
  }
  return shuffle(picked);
}

function withShuffledOptions(q: Q) {
  const idx = shuffle(q.o.map((_, i) => i));
  const answerSet = new Set(Array.isArray(q.a) ? q.a : [q.a]);
  const correctPositions = idx.map((orig, pos) => (answerSet.has(orig) ? pos : -1)).filter((p) => p >= 0);
  return { options: idx.map((i) => q.o[i]), correctPositions: new Set(correctPositions) };
}

export default function MockExam() {
  const [phase, setPhase] = useState<'intro' | 'running' | 'review'>('intro');
  const [items, setItems] = useState<(Q & { options: string[]; correctPositions: Set<number> })[]>([]);
  const [answers, setAnswers] = useState<Record<string, Set<number>>>({});
  const [i, setI] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(DURATION_MIN * 60);
  const timerRef = useRef<number | null>(null);

  // Warn when a domain's pool can't actually vary between mocks — the exact
  // defect the 150-item expansion is meant to fix. Computed once from the raw bank.
  const poolWarning = useMemo(() => {
    const byDomain = new Map<number, number>();
    for (const q of allQuestions as Q[]) byDomain.set(q.d, (byDomain.get(q.d) ?? 0) + 1);
    const tight: string[] = [];
    for (const [dStr, need] of Object.entries(MOCK_COMPOSITION)) {
      const have = byDomain.get(Number(dStr)) ?? 0;
      if (have <= need) tight.push(`D${dStr} (${have}/${need} available — draws its full pool every time)`);
    }
    return tight;
  }, []);

  function start() {
    const picked = sampleMock().map((q) => ({ ...q, ...withShuffledOptions(q) }));
    setItems(picked);
    setAnswers({});
    setI(0);
    setSecondsLeft(DURATION_MIN * 60);
    setPhase('running');
  }

  useEffect(() => {
    if (phase !== 'running') return;
    timerRef.current = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          submit();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  function toggle(qid: string, pos: number, multi: boolean) {
    setAnswers((prev) => {
      const next = { ...prev };
      const set = new Set(next[qid] ?? []);
      if (multi) { set.has(pos) ? set.delete(pos) : set.add(pos); }
      else { set.clear(); set.add(pos); }
      next[qid] = set;
      return next;
    });
  }

  function submit() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    setPhase('review');
    let correct = 0;
    const byDomain: Record<number, { correct: number; total: number }> = {};
    for (const it of items) {
      const given = answers[it.id] ?? new Set<number>();
      const isCorrect = given.size === it.correctPositions.size && [...given].every((p) => it.correctPositions.has(p));
      byDomain[it.d] ??= { correct: 0, total: 0 };
      byDomain[it.d].total += 1;
      if (isCorrect) { correct += 1; byDomain[it.d].correct += 1; }
      else Store.recordMiss(it.id, it.s, it.d);
    }
    const scorePct = items.length ? correct / items.length : 0;
    // Anthropic publishes no raw-to-scaled mapping. This is an ESTIMATE:
    // linear 100-1000 scale, 720 cut assumed at ~69% correct. [Guessing] on the
    // mapping shape; [Certain] on the 720 cut and 100-1000 range (exam guide §9).
    const scaledEstimate = Math.round(100 + 900 * scorePct);
    Store.addMockResult({ id: `mock-${Date.now()}`, takenAt: Date.now(), scorePct, scaledEstimate, byDomain });
  }

  if (phase === 'intro') {
    return (
      <div className="mock-wrap">
        <p className="score-note" style={{ fontSize: '1rem', maxWidth: '62ch' }}>
          53 items sampled to the exam blueprint, a 120-minute countdown, and explanations withheld
          until you submit — the same shape as the real thing.
        </p>
        {poolWarning.length > 0 && (
          <div className="quiz-explain" style={{ marginTop: 24 }}>
            <span className="qe-label">Bank variance warning</span>
            The bank holds {(allQuestions as Q[]).length} items. These domains will draw an identical
            set every mock until expanded: {poolWarning.join('; ')}.
          </div>
        )}
        <button className="btn" onClick={start} style={{ marginTop: 32 }}>Start mock exam</button>
      </div>
    );
  }

  if (phase === 'running') {
    const q = items[i];
    if (!q) return null;
    const given = answers[q.id] ?? new Set<number>();
    const isMulti = q.correctPositions.size > 1;
    const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
    const ss = String(secondsLeft % 60).padStart(2, '0');
    return (
      <div className="mock-wrap">
        <div className="mock-header">
          <span>Item {i + 1} of {items.length}</span>
          <span className={secondsLeft < 300 ? 'mock-timer low' : 'mock-timer'}>{mm}:{ss}</span>
        </div>
        <p className="quiz-tag">Domain {q.d} · {q.s}</p>
        <p className="quiz-stem">{q.q}</p>
        {isMulti && <p className="quiz-hint">Select all that apply ({q.correctPositions.size}).</p>}
        <div className="quiz-options">
          {q.options.map((opt, pos) => (
            <button
              key={pos}
              className={given.has(pos) ? 'quiz-opt selected' : 'quiz-opt'}
              onClick={() => toggle(q.id, pos, isMulti)}
            >
              <span className="opt-k">{KEYS[pos]}</span>
              <span>{opt}</span>
            </button>
          ))}
        </div>
        <div className="mock-nav">
          <button className="btn btn-ghost" disabled={i === 0} onClick={() => setI((n) => n - 1)}>← Previous</button>
          {i < items.length - 1 ? (
            <button className="btn btn-ghost" onClick={() => setI((n) => n + 1)}>Next →</button>
          ) : (
            <button className="btn" onClick={submit}>Submit exam</button>
          )}
        </div>
      </div>
    );
  }

  // review
  const hist = Store.getMockHistory();
  const last = hist[hist.length - 1];
  return (
    <div className="mock-wrap">
      <p className="quiz-tag">Result</p>
      <p className={last.scaledEstimate >= 720 ? 'result-verdict pass' : 'result-verdict fail'}>
        {last.scaledEstimate >= 720 ? 'Estimated pass' : 'Estimated fail'}
      </p>
      <p className="score-big">{last.scaledEstimate}<span style={{ fontSize: '1.25rem', color: 'var(--ink-3)' }}> / 1000</span></p>
      <p className="score-note">
        Cut score is 720. This is a linear estimate from raw percent correct
        ({Math.round(last.scorePct * 100)}% of {items.length}) &mdash; Anthropic does not publish the
        real scaling curve, so treat it as a directional signal, not a score.
      </p>
      <table className="dtable">
        <thead><tr><th>Domain</th><th>Correct</th><th>Percent</th></tr></thead>
        <tbody>
          {Object.entries(last.byDomain).map(([d, r]) => (
            <tr key={d}>
              <td>Domain {d}</td>
              <td className="num">{r.correct}/{r.total}</td>
              <td className="num">{Math.round((r.correct / r.total) * 100)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="index-head" style={{ marginTop: 52 }}>Item review</p>
      {items.map((q, idx) => {
        const given = answers[q.id] ?? new Set<number>();
        const isCorrect = given.size === q.correctPositions.size && [...given].every((p) => q.correctPositions.has(p));
        return (
          <div key={q.id} className={isCorrect ? 'review-item correct' : 'review-item wrong'}>
            <p className="quiz-tag" style={{ marginBottom: 8 }}>{idx + 1}. {q.s} &middot; D{q.d}</p>
            <p className="quiz-stem">{q.q}</p>
            <p className="quiz-explain-text">{q.e}</p>
          </div>
        );
      })}
      <button className="btn" style={{ marginTop: 36 }} onClick={() => setPhase('intro')}>Take another mock</button>
    </div>
  );
}
