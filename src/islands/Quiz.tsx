import { useMemo, useState } from 'react';
import allQuestions from '../data/questions/all.json';
import { Store } from '../lib/store';

type Q = {
  id: string; d: number; s: string; q: string; o: string[];
  a: number | number[]; e: string; pattern: string;
};

const KEYS = ['A', 'B', 'C', 'D'];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Shuffle option order per question, remapping the answer index(es) to match.
// This is the fix for the legacy bank's "60 of 64 answers landed in position B" defect.
function shuffledOptions(q: Q) {
  const idx = shuffle(q.o.map((_, i) => i));
  const answerSet = new Set(Array.isArray(q.a) ? q.a : [q.a]);
  const correctPositions = new Set(
    idx.map((orig, pos) => (answerSet.has(orig) ? pos : -1)).filter((p) => p >= 0)
  );
  return { options: idx.map((i) => q.o[i]), correctPositions };
}

export default function Quiz() {
  const [domainFilter, setDomainFilter] = useState<number | 'all'>('all');
  const pool = useMemo(() => {
    const list = (allQuestions as Q[]).filter((q) => domainFilter === 'all' || q.d === domainFilter);
    return shuffle(list);
  }, [domainFilter]);

  const [i, setI] = useState(0);
  const [round, setRound] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [revealed, setRevealed] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [answered, setAnswered] = useState(0);

  const q = pool[i % Math.max(pool.length, 1)];
  const { options, correctPositions } = useMemo(
    () => (q ? shuffledOptions(q) : { options: [], correctPositions: new Set<number>() }),
    [q, round]
  );

  if (!q) return <p className="empty-note">No questions in this domain yet.</p>;

  const isMulti = correctPositions.size > 1;

  function toggle(pos: number) {
    if (revealed) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (isMulti) {
        if (next.has(pos)) next.delete(pos); else next.add(pos);
      } else {
        next.clear();
        next.add(pos);
      }
      return next;
    });
  }

  function submit() {
    if (revealed || selected.size === 0) return;
    const correct =
      selected.size === correctPositions.size && [...selected].every((p) => correctPositions.has(p));
    setRevealed(true);
    setAnswered((n) => n + 1);
    if (correct) setCorrectCount((n) => n + 1);
    else Store.recordMiss(q.id, q.s, q.d);
  }

  function next() {
    setSelected(new Set());
    setRevealed(false);
    setI((n) => n + 1);
    setRound((r) => r + 1);
  }

  const pct = answered > 0 ? Math.round((correctCount / answered) * 100) : 0;

  return (
    <div className="quiz-wrap">
      <div className="quiz-bar">
        <label>
          Domain{' '}
          <select
            value={domainFilter}
            onChange={(e) => {
              setDomainFilter(e.target.value === 'all' ? 'all' : Number(e.target.value));
              setI(0); setSelected(new Set()); setRevealed(false);
            }}
          >
            <option value="all">All ({(allQuestions as Q[]).length})</option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((d) => (
              <option key={d} value={d}>Domain {d}</option>
            ))}
          </select>
        </label>
        <span className="quiz-score">
          {answered > 0 ? <>Score <b>{correctCount}/{answered}</b> · {pct}%</> : 'No answers yet'}
        </span>
      </div>

      <p className="quiz-tag">{q.s} · Domain {q.d}</p>
      <p className="quiz-stem">{q.q}</p>
      {isMulti && <p className="quiz-hint">Select all that apply ({correctPositions.size}).</p>}

      <div className="quiz-options">
        {options.map((opt, pos) => {
          const isSelected = selected.has(pos);
          const isCorrect = correctPositions.has(pos);
          let cls = 'quiz-opt';
          if (revealed) {
            if (isCorrect) cls += ' correct';
            else if (isSelected) cls += ' wrong';
          } else if (isSelected) cls += ' selected';
          return (
            <button key={pos} className={cls} onClick={() => toggle(pos)} disabled={revealed}>
              <span className="opt-k">{KEYS[pos]}</span>
              <span>{opt}</span>
            </button>
          );
        })}
      </div>

      {!revealed ? (
        <button className="btn" onClick={submit} disabled={selected.size === 0}>Submit answer</button>
      ) : (
        <>
          <div className="quiz-explain">
            <span className="qe-label">Why</span>
            {q.e}
          </div>
          <div className="quiz-actions">
            <button className="btn" onClick={next}>Next question</button>
            <span className="quiz-hint" style={{ margin: 0 }}>{q.pattern.replace(/-/g, ' ')}</span>
          </div>
        </>
      )}
    </div>
  );
}
