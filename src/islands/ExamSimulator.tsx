// Pearson-style exam simulator.
//
// State lives in a pure reducer (src/lib/store/exam.ts) and is persisted on
// every change, so a reload, a closed tab or a killed phone app resumes with
// the right answers and the right remaining time. The timer only dispatches
// TICK; grading happens inside the reducer from the state at that instant.
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import QuestionCell from './QuestionCell';
import { loadBank } from '../lib/bank/load';
import { drawExam, optionOrder } from '../lib/bank/sampler';
import { mulberry32, newSeed } from '../lib/bank/shuffle';
import type { Question } from '../lib/bank/schema';
import { DOMAINS, OBJECTIVE_BY_ID, domainName } from '../lib/blueprint';
import { Store } from '../lib/store';
import { useHydrated, useStore } from '../lib/store/react';
import {
  MODE_CONFIG,
  createSession,
  dwellTimes,
  examReducer,
  remainingMs,
  toRecord,
  type ExamAction,
  type ExamMode,
  type ExamRecord,
  type ExamSession,
} from '../lib/store/exam';

const PACE_MS = (120 * 60 * 1000) / 53; // 2.26 min per item

function fmt(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h ? h + ':' : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(sec).padStart(2, '0')}`;
}

type Props = { base?: string };

function reducer(s: ExamSession | null, a: ExamAction | { type: 'LOAD'; s: ExamSession | null }): ExamSession | null {
  if (a.type === 'LOAD') return a.s;
  return s ? examReducer(s, a) : s;
}

export default function ExamSimulator({ base = '/' }: Props) {
  const hydrated = useHydrated();
  const history = useStore('exam:history');
  const [session, dispatch] = useReducer(reducer, null);
  const [bank, setBank] = useState<Question[] | null>(null);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const [hideTimer, setHideTimer] = useState(false);
  const [confirmStep, setConfirmStep] = useState(0);
  const [otherTab, setOtherTab] = useState(false);
  const [viewRecord, setViewRecord] = useState<ExamRecord | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const loaded = useRef(false);

  useEffect(() => {
    loadBank().then(setBank).catch((e) => setError(String(e)));
  }, []);

  // Resume an active session on mount.
  useEffect(() => {
    if (!hydrated || loaded.current) return;
    loaded.current = true;
    const active = Store.activeExam();
    if (active) dispatch({ type: 'LOAD', s: active });
  }, [hydrated]);

  const running = !!session && !session.submittedAt;

  // Persist every change (debounced) and on pagehide.
  useEffect(() => {
    if (!session) return;
    const t = window.setTimeout(() => Store.saveExam(session), 250);
    const flush = () => Store.saveExam(session);
    window.addEventListener('pagehide', flush);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('pagehide', flush);
    };
  }, [session]);

  // When an exam finishes (submit or timeout), log answers and archive it.
  const archived = useRef<string | null>(null);
  useEffect(() => {
    if (!session?.submittedAt || archived.current === session.id) return;
    archived.current = session.id;
    const dwell = dwellTimes(session);
    for (const q of session.items) {
      const chosen = session.answers[q.id] ?? [];
      if (!chosen.length) continue; // unanswered items are not evidence about knowledge
      Store.recordAnswer(q, !!session.result?.perItem[q.id], { src: 'exam', ms: dwell[q.id], sid: session.id, now: session.submittedAt });
    }
    const rec = toRecord(session);
    Store.archiveExam(rec);
    setViewRecord(rec);
  }, [session]);

  // Timer: dispatch only. Also re-check immediately when the tab becomes visible.
  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      dispatch({ type: 'TICK', now: t });
    };
    const id = window.setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    tick();
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [running]);

  // Exam focus mode: background off, mobile tab bar hidden.
  useEffect(() => {
    if (!running) return;
    const prev = document.body.dataset.grid;
    document.body.dataset.grid = 'off';
    document.body.classList.add('exam-running');
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => {
      document.body.dataset.grid = prev ?? 'dim';
      document.body.classList.remove('exam-running');
      window.removeEventListener('beforeunload', warn);
    };
  }, [running]);

  // Second-tab guard.
  useEffect(() => {
    if (!running || typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel('ccdvf-exam');
    ch.onmessage = (e) => {
      if (e.data?.type === 'ping') ch.postMessage({ type: 'pong' });
      if (e.data?.type === 'pong') setOtherTab(true);
    };
    ch.postMessage({ type: 'ping' });
    return () => ch.close();
  }, [running]);

  const remaining = session ? remainingMs(session, now) : 0;
  useEffect(() => {
    if (running && session && !session.warned5 && remaining > 0 && remaining <= 5 * 60 * 1000) {
      dispatch({ type: 'WARNED' });
      setHideTimer(false);
    }
  }, [running, remaining, session]);

  const start = (mode: ExamMode) => {
    if (!bank) return;
    const seed = Number(new URLSearchParams(location.search).get('seed')) || newSeed();
    const rng = mulberry32(seed);
    const items = drawExam(bank, { rng, seen: Store.seenIds() }, MODE_CONFIG[mode].items);
    const order = Object.fromEntries(items.map((q) => [q.id, optionOrder(q, rng)]));
    archived.current = null;
    setViewRecord(null);
    setConfirmStep(0);
    dispatch({ type: 'LOAD', s: createSession(mode, items, order, seed, Date.now()) });
    window.scrollTo({ top: 0 });
  };

  const discard = () => {
    Store.saveExam(null);
    dispatch({ type: 'LOAD', s: null });
  };

  // Keyboard shortcuts while running.
  useEffect(() => {
    if (!running || !session || session.pausedAt) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (dialogRef.current?.open) return;
      const q = session.items[session.cursor];
      const k = e.key.toLowerCase();
      const t = Date.now();
      if (session.view === 'question') {
        const idx = 'abcdef'.indexOf(k) >= 0 ? 'abcdef'.indexOf(k) : '123456'.indexOf(k);
        if (idx >= 0 && idx < q.options.length) {
          e.preventDefault();
          toggle(session.order[q.id][idx]);
          return;
        }
        if (k === 'f') return void dispatch({ type: 'FLAG', qid: q.id });
      }
      if (k === 'n' || e.key === 'ArrowRight') dispatch({ type: 'GOTO', index: session.cursor + 1, now: t });
      if (k === 'p' || e.key === 'ArrowLeft') dispatch({ type: 'GOTO', index: session.cursor - 1, now: t });
      if (k === 'r') dispatch({ type: 'VIEW', view: session.view === 'review' ? 'question' : 'review', now: t });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function toggle(id: string) {
    if (!session) return;
    const q = session.items[session.cursor];
    const cur = session.answers[q.id] ?? [];
    let choice: string[];
    if (q.type === 'single') choice = cur[0] === id ? [] : [id];
    else choice = cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= q.select ? [...cur.slice(1), id] : [...cur, id];
    dispatch({ type: 'ANSWER', qid: q.id, choice, now: Date.now() });
  }

  const counts = useMemo(() => {
    if (!session) return { answered: 0, unanswered: 0, flagged: 0 };
    const answered = session.items.filter((q) => (session.answers[q.id]?.length ?? 0) === q.select).length;
    return { answered, unanswered: session.items.length - answered, flagged: Object.keys(session.flags).length };
  }, [session]);

  if (error) return <div className="empty">Could not load the question bank ({error}).</div>;
  if (!hydrated || !bank) return <div className="empty">Loading exam engine…</div>;

  // ----------------------------------------------------------------- results --
  if (viewRecord || (session && session.submittedAt)) {
    const rec = viewRecord ?? toRecord(session!);
    const itemsById = new Map(bank.map((q) => [q.id, q]));
    const snapshot = session && session.id === rec.id ? new Map(session.items.map((q) => [q.id, q])) : itemsById;
    return (
      <Results
        rec={rec}
        items={rec.items.map((id) => snapshot.get(id)).filter((q): q is Question => !!q)}
        base={base}
        onNew={() => {
          discard();
          setViewRecord(null);
        }}
      />
    );
  }

  // ------------------------------------------------------------------- intro --
  if (!session) {
    return (
      <Intro
        history={history}
        bankSize={bank.length}
        onStart={start}
        onView={(r) => setViewRecord(r)}
      />
    );
  }

  // ----------------------------------------------------------------- running --
  const q = session.items[session.cursor];
  const timerLow = remaining <= 5 * 60 * 1000;
  const elapsed = session.durationMs - remaining;
  const expectedAt = (session.cursor + 1) * (session.durationMs / session.items.length);
  const behind = elapsed > expectedAt + 3 * 60 * 1000;
  const cfg = MODE_CONFIG[session.mode];

  return (
    <div className="exam-shell">
      {otherTab && (
        <div className="callout callout-trap" role="alert">
          <p className="callout-title">Open in another tab</p>
          <p>This exam is also open in another tab or window. Use one at a time or answers may overwrite each other.</p>
        </div>
      )}
      <div className="exam-head" role="region" aria-label="Exam controls">
        <span className="pos">Item {session.cursor + 1} of {session.items.length}</span>
        <span className="pace" aria-live="off">{counts.answered} answered · {counts.flagged} flagged</span>
        <span className="spacer" />
        {!hideTimer || timerLow ? (
          <span className={`timer${timerLow ? ' is-low' : ''}`} role="timer" aria-live={timerLow ? 'polite' : 'off'} aria-label={`Time remaining ${fmt(remaining)}`}>
            {fmt(remaining)}
          </span>
        ) : (
          <span className="timer is-hidden">--:--</span>
        )}
        <button className="btn btn-sm btn-ghost" onClick={() => setHideTimer((h) => !h)}>{hideTimer ? 'Show' : 'Hide'} timer</button>
        {cfg.pausable && (
          <button className="btn btn-sm" onClick={() => dispatch(session.pausedAt ? { type: 'RESUME', now: Date.now() } : { type: 'PAUSE', now: Date.now() })}>
            {session.pausedAt ? 'Resume' : 'Pause'}
          </button>
        )}
        <span className={`pace${behind ? ' is-behind' : ''}`}>{behind ? 'Behind pace: flag and move on' : 'On pace'}</span>
      </div>

      {session.pausedAt ? (
        <div className="panel paused">
          <h2>Paused</h2>
          <p className="muted">Questions are hidden while paused. The clock is stopped.</p>
          <button className="btn btn-run" onClick={() => dispatch({ type: 'RESUME', now: Date.now() })}>Resume</button>
        </div>
      ) : session.view === 'review' ? (
        <div className="panel">
          <div className="panel-head">
            <h2>Review screen</h2>
            <span className="muted">{counts.unanswered} unanswered · {counts.flagged} flagged</span>
          </div>
          <ReviewGrid session={session} onPick={(i) => dispatch({ type: 'GOTO', index: i, now: Date.now() })} />
          <div className="btn-row" style={{ marginTop: 18 }}>
            {counts.flagged > 0 && (
              <button className="btn" onClick={() => dispatch({ type: 'GOTO', index: session.items.findIndex((x) => session.flags[x.id]), now: Date.now() })}>
                Review flagged
              </button>
            )}
            {counts.unanswered > 0 && (
              <button className="btn" onClick={() => dispatch({ type: 'GOTO', index: session.items.findIndex((x) => (session.answers[x.id]?.length ?? 0) !== x.select), now: Date.now() })}>
                Review unanswered
              </button>
            )}
            <span className="spacer" />
            <button className="btn btn-run" onClick={() => { setConfirmStep(1); dialogRef.current?.showModal(); }}>End exam</button>
          </div>
        </div>
      ) : (
        <QuestionCell
          q={q}
          order={session.order[q.id]}
          chosen={session.answers[q.id] ?? []}
          onToggle={toggle}
          mode="answer"
          struck={session.struck[q.id]}
          onStrike={(id) => dispatch({ type: 'STRIKE', qid: q.id, option: id })}
          index={session.cursor}
          total={session.items.length}
          showMeta={false}
          exam
        />
      )}

      {!session.pausedAt && (
        <div className="exam-foot">
          <button className="btn" disabled={session.cursor === 0 && session.view === 'question'} onClick={() => dispatch({ type: 'GOTO', index: session.cursor - 1, now: Date.now() })}>← Previous</button>
          {session.view === 'question' && (
            <button className={`btn${session.flags[q.id] ? ' is-flagged' : ''}`} aria-pressed={!!session.flags[q.id]} onClick={() => dispatch({ type: 'FLAG', qid: q.id })}>
              ⚑ {session.flags[q.id] ? 'Flagged' : 'Flag for review'}
            </button>
          )}
          <span className="spacer" />
          <button className="btn" onClick={() => dispatch({ type: 'VIEW', view: session.view === 'review' ? 'question' : 'review', now: Date.now() })}>
            {session.view === 'review' ? 'Back to item' : 'Review screen'}
          </button>
          {session.cursor < session.items.length - 1 || session.view === 'review' ? (
            <button className="btn btn-primary" onClick={() => dispatch({ type: 'GOTO', index: session.cursor + 1, now: Date.now() })}>Next →</button>
          ) : (
            <button className="btn btn-primary" onClick={() => dispatch({ type: 'VIEW', view: 'review', now: Date.now() })}>Finish → review</button>
          )}
        </div>
      )}
      <p className="faint" style={{ fontSize: 12.5 }}>Keys: A–D choose · F flag · N / P next / previous · R review screen. ⊘ eliminates an option.</p>

      <dialog className="modal" ref={dialogRef} onClose={() => setConfirmStep(0)}>
        {confirmStep === 1 ? (
          <>
            <h2>End the exam?</h2>
            <p>
              You have <b>{counts.unanswered}</b> unanswered item{counts.unanswered === 1 ? '' : 's'} and <b>{counts.flagged}</b> flagged for review.
              {counts.unanswered > 0 && ' Unanswered items score as wrong; there is no penalty for guessing.'}
            </p>
            <p className="muted">Time remaining: {fmt(remaining)}</p>
            <div className="btn-row">
              <button className="btn" onClick={() => dialogRef.current?.close()} autoFocus>Keep working</button>
              <button className="btn btn-run" onClick={() => setConfirmStep(2)}>End exam</button>
            </div>
          </>
        ) : (
          <>
            <h2>Confirm</h2>
            <p>Once ended, answers cannot be changed.</p>
            <div className="btn-row">
              <button className="btn" onClick={() => dialogRef.current?.close()} autoFocus>Go back</button>
              <button className="btn btn-run" onClick={() => { dialogRef.current?.close(); dispatch({ type: 'SUBMIT', now: Date.now() }); }}>Yes, end and score</button>
            </div>
          </>
        )}
      </dialog>
    </div>
  );
}

function ReviewGrid({ session, onPick }: { session: ExamSession; onPick: (i: number) => void }) {
  const [filter, setFilter] = useState<'all' | 'incomplete' | 'flagged'>('all');
  return (
    <>
      <div className="seg" role="group" aria-label="Filter" style={{ marginBottom: 12 }}>
        {(['all', 'incomplete', 'flagged'] as const).map((f) => (
          <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>
      <div className="navgrid">
        {session.items.map((q, i) => {
          const answered = (session.answers[q.id]?.length ?? 0) === q.select;
          const flagged = !!session.flags[q.id];
          if (filter === 'incomplete' && answered) return null;
          if (filter === 'flagged' && !flagged) return null;
          const cls = [answered ? 'is-answered' : 'is-unanswered', flagged && 'is-flagged', i === session.cursor && 'is-current'].filter(Boolean).join(' ');
          return (
            <button key={q.id} className={cls} onClick={() => onPick(i)} aria-label={`Item ${i + 1}, ${answered ? 'answered' : 'unanswered'}${flagged ? ', flagged' : ''}`}>
              {i + 1}
            </button>
          );
        })}
      </div>
      <div className="legend">
        <span><i className="l-ans" />Answered</span>
        <span><i className="l-un" />Unanswered</span>
        <span><i className="l-flag" />Flagged</span>
      </div>
    </>
  );
}

function Intro({ history, bankSize, onStart, onView }: { history: ExamRecord[]; bankSize: number; onStart: (m: ExamMode) => void; onView: (r: ExamRecord) => void }) {
  const recent = [...history].reverse().slice(0, 10);
  return (
    <div className="stack">
      <div className="cards">
        {(Object.keys(MODE_CONFIG) as ExamMode[]).map((m) => (
          <div className="card" key={m}>
            <p className="eyebrow">{MODE_CONFIG[m].items} items · {MODE_CONFIG[m].minutes} min</p>
            <h3>{MODE_CONFIG[m].label}</h3>
            <p>
              {m === 'strict' && 'Exactly like exam day: no pause, timer runs on reload. The real readiness check.'}
              {m === 'practice' && 'Full length and blueprint-weighted, but you can pause. Good for a first run.'}
              {m === 'mini' && 'A 20-item, 45-minute slice at the same per-item pace. Fits a lunch break.'}
            </p>
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button className="btn btn-run" onClick={() => onStart(m)}>▶ Start</button>
            </div>
          </div>
        ))}
      </div>
      <div className="callout callout-note">
        <p className="callout-title">How this mirrors the real exam</p>
        <p>
          Items are drawn per domain exactly as the blueprint weights them (D2 gets 17 of 53), then per objective by weight, preferring
          items you have not seen. No feedback until the end. Pace is 2.26 minutes per item; flag anything slow and come back. The
          scaled score shown afterwards is a linear estimate, because Anthropic does not publish its scaling. The pass mark is 720.
        </p>
      </div>
      <p className="faint">Drawing from {bankSize} original items. Your answers here feed spaced repetition and mastery tracking.</p>
      {recent.length > 0 && (
        <div className="panel">
          <div className="panel-head"><h3>History</h3></div>
          <div className="table-wrap">
            <table className="grid-table">
              <thead><tr><th>Date</th><th>Mode</th><th className="n">Score</th><th className="n">Est.</th><th /></tr></thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id}>
                    <td>{new Date(r.takenAt).toLocaleString()}</td>
                    <td>{r.mode}{r.reason === 'timeout' ? ' · timed out' : ''}</td>
                    <td className="n">{r.correct}/{r.total}</td>
                    <td className="n" style={{ color: r.scaledEstimate >= 720 ? 'var(--ok)' : 'var(--bad)' }}>{r.scaledEstimate}</td>
                    <td>{r.items.length > 0 && <button className="btn btn-sm btn-ghost" onClick={() => onView(r)}>Review</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Results({ rec, items, base, onNew }: { rec: ExamRecord; items: Question[]; base: string; onNew: () => void }) {
  const [filter, setFilter] = useState<'wrong' | 'flagged' | 'all'>('wrong');
  const pass = rec.scaledEstimate >= 720;
  const byId = new Map(items.map((q) => [q.id, q]));

  // Pacing: cumulative dwell in item order vs the 2.26 min/item line.
  const n = rec.items.length;
  const pace = PACE_MS; // the mini mock (45 min / 20) runs at the same per-item pace
  let cum = 0;
  const points = rec.items.map((id, i) => {
    cum += rec.dwell[id] ?? 0;
    return { i: i + 1, t: cum };
  });
  const maxT = Math.max(points[points.length - 1]?.t ?? 0, n * pace);
  const sinks = [...rec.items].sort((a, b) => (rec.dwell[b] ?? 0) - (rec.dwell[a] ?? 0)).slice(0, 5);
  const flaggedAcc = (() => {
    const f = rec.flags;
    const fc = f.filter((id) => rec.perItem[id]).length;
    const un = rec.items.filter((id) => !f.includes(id));
    const uc = un.filter((id) => rec.perItem[id]).length;
    return { f: f.length, fc, u: un.length, uc };
  })();
  const changes = Object.entries(rec.changes).filter(([, c]) => c > 0);
  const changedRight = changes.filter(([id]) => rec.perItem[id]).length;

  const shown = rec.items.filter((id) => (filter === 'all' ? true : filter === 'flagged' ? rec.flags.includes(id) : !rec.perItem[id]));

  const W = 640;
  const H = 220;
  const px = (i: number) => 40 + (i / Math.max(1, n)) * (W - 56);
  const py = (t: number) => H - 28 - (t / Math.max(1, maxT)) * (H - 48);

  return (
    <div className="stack">
      <div className="panel">
        <div className="score-hero">
          <div>
            <div className={`score-big ${pass ? 'is-pass' : 'is-fail'}`}>{rec.scaledEstimate}</div>
            <div className="kpi-l">Estimated scaled score · pass is 720</div>
          </div>
          <div>
            <h2 style={{ margin: 0 }}>{pass ? 'Above the pass line' : 'Below the pass line'}</h2>
            <p className="muted" style={{ margin: '6px 0 0' }}>
              {rec.correct} of {rec.total} correct ({Math.round((rec.correct / Math.max(1, rec.total)) * 100)}%) · {rec.answered} answered ·{' '}
              {fmt(rec.usedMs)} used{rec.reason === 'timeout' ? ' · time expired, answered items were scored' : ''}
            </p>
            <p className="faint" style={{ margin: '6px 0 0', fontSize: 13 }}>
              Linear estimate (100 + 900 × percent correct). Real scaling is unpublished; treat 75%+ as the comfortable zone.
            </p>
          </div>
        </div>
        <div className="btn-row" style={{ marginTop: 16 }}>
          <button className="btn btn-run" onClick={onNew}>New exam</button>
          <a className="btn" href={`${base}practice/?mode=due`}>Drill the misses</a>
          <a className="btn btn-ghost" href={`${base}progress/`}>Progress</a>
        </div>
      </div>

      <div className="split">
        <div className="panel">
          <div className="panel-head"><h3>By domain</h3></div>
          {rec.byDomain.map((d) => (
            <div className="bar-row" key={d.domain} data-d={d.domain}>
              <span className="lbl">D{d.domain} · {domainName(d.domain)}</span>
              <div className="meter"><i style={{ width: `${(d.correct / Math.max(1, d.total)) * 100}%` }} /></div>
              <span className="val">{d.correct}/{d.total}</span>
            </div>
          ))}
          <p className="faint" style={{ fontSize: 12.5, marginTop: 10 }}>Per-domain results are diagnostic only on the real exam; pass/fail comes from the total.</p>
        </div>
        <div className="panel">
          <div className="panel-head"><h3>Pacing</h3><span className="faint num">{(rec.usedMs / Math.max(1, n) / 60000).toFixed(2)} min/item</span></div>
          {points.length > 1 && rec.usedMs > 0 ? (
            <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Cumulative time per item against the 2.26 minute pace line">
              <line className="axis" x1={40} y1={H - 28} x2={W - 16} y2={H - 28} />
              <line className="axis" x1={40} y1={20} x2={40} y2={H - 28} />
              <line x1={px(0)} y1={py(0)} x2={px(n)} y2={py(n * pace)} stroke="var(--text-3)" strokeDasharray="4 4" />
              {[Math.round(n * 0.34), Math.round(n * 0.66)].map((c) => (
                <g key={c}>
                  <line className="gridline" x1={px(c)} y1={20} x2={px(c)} y2={H - 28} />
                  <text x={px(c) + 4} y={30}>item {c}</text>
                </g>
              ))}
              <polyline fill="none" stroke="var(--accent)" strokeWidth={2} points={points.map((p) => `${px(p.i)},${py(p.t)}`).join(' ')} />
              <text x={44} y={16}>minutes (max {Math.round(maxT / 60000)})</text>
              <text x={W - 70} y={H - 10}>item {n}</text>
            </svg>
          ) : (
            <p className="muted">No timing data for this record.</p>
          )}
          <p className="faint" style={{ fontSize: 12.5 }}>Dashed: 2.26 min/item pace. Above the line means behind.</p>
        </div>
      </div>

      <div className="split">
        <div className="panel">
          <div className="panel-head"><h3>Time sinks</h3></div>
          <ol style={{ margin: 0, paddingLeft: 18 }}>
            {sinks.map((id) => (
              <li key={id} style={{ margin: '6px 0' }}>
                <span className="num">{fmt(rec.dwell[id] ?? 0)}</span> · {OBJECTIVE_BY_ID.get(byId.get(id)?.objective ?? '')?.name ?? id}{' '}
                {rec.perItem[id] ? <span className="tag tag-ok">✓</span> : <span className="tag tag-bad">✗</span>}
              </li>
            ))}
          </ol>
        </div>
        <div className="panel">
          <div className="panel-head"><h3>Behaviour</h3></div>
          <p>Flagged: {flaggedAcc.f ? `${flaggedAcc.fc}/${flaggedAcc.f} correct` : 'none'} · Unflagged: {flaggedAcc.uc}/{flaggedAcc.u} correct</p>
          <p>Answers changed: {changes.length}{changes.length ? ` (${changedRight} ended correct)` : ''}</p>
          <p className="faint" style={{ fontSize: 12.5 }}>If changed answers mostly end wrong, trust your first read more.</p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>Item review</h3>
          <div className="seg" role="group" aria-label="Filter items">
            {(['wrong', 'flagged', 'all'] as const).map((f) => (
              <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>{f}</button>
            ))}
          </div>
        </div>
        {shown.length === 0 && <p className="muted">Nothing in this filter.</p>}
        {shown.map((id) => {
          const q = byId.get(id);
          if (!q) return null;
          const idx = rec.items.indexOf(id);
          return (
            <QuestionCell
              key={id}
              q={q}
              order={rec.order[id] ?? q.options.map((o) => o.id)}
              chosen={rec.answers[id] ?? []}
              mode="revealed"
              index={idx}
              total={n}
              base={base}
            />
          );
        })}
      </div>
      <p className="faint">Domains in this exam: {DOMAINS.map((d) => `D${d.n} ${rec.byDomain.find((x) => x.domain === d.n)?.total ?? 0}`).join(' · ')}</p>
    </div>
  );
}
