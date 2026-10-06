// Practice hub: pick a mode, run a fixed-length session one question at a
// time with instant feedback, then get a summary. Every answer feeds the
// attempt log and spaced repetition through Store.recordAnswer.
//
// Also used embedded on objective pages (preset.objective) as the Practice tab.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QuestionCell from './QuestionCell';
import { loadBank } from '../lib/bank/load';
import { drawWeighted, filterBank, optionOrder } from '../lib/bank/sampler';
import { shuffle } from '../lib/bank/shuffle';
import { isCorrect, type Question } from '../lib/bank/schema';
import { DOMAINS, OBJECTIVES, OBJECTIVE_BY_ID } from '../lib/blueprint';
import { Store } from '../lib/store';
import { useHydrated, useStore } from '../lib/store/react';
import { objectiveMastery } from '../lib/analytics/mastery';

type Mode = 'weighted' | 'due' | 'weak' | 'domain' | 'objective' | 'multi' | 'unseen' | 'retry';
type Conf = 'sure' | 'unsure' | 'guess';

type Props = { base?: string; preset?: { objective?: string }; };

const MODES: { id: Mode; title: string; blurb: string }[] = [
  { id: 'weighted', title: 'Exam-weighted mix', blurb: 'Objectives drawn in proportion to blueprint weight.' },
  { id: 'due', title: 'Due reviews', blurb: 'Spaced-repetition cards that are due now.' },
  { id: 'weak', title: 'Weak spots', blurb: 'Your lowest-mastery objectives, heaviest first.' },
  { id: 'domain', title: 'By domain', blurb: 'Drill one or more domains.' },
  { id: 'objective', title: 'By objective', blurb: 'Drill a single objective.' },
  { id: 'multi', title: 'Multi-response only', blurb: '"Select two" items, where partial credit does not exist.' },
  { id: 'unseen', title: 'Unseen only', blurb: 'Items you have never answered.' },
];

type Item = { q: Question; order: string[] };
type Result = { q: Question; ok: boolean; ms: number; conf?: Conf };

function readParams(): URLSearchParams {
  return typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);
}

export default function PracticeHub({ base = '/', preset }: Props) {
  const hydrated = useHydrated();
  const attempts = useStore('attempts');
  const srs = useStore('srs');
  const [bank, setBank] = useState<Question[] | null>(null);
  const [error, setError] = useState('');
  const params = useMemo(readParams, []);
  const [mode, setMode] = useState<Mode>(preset?.objective ? 'objective' : ((params.get('mode') as Mode) || 'weighted'));
  const [n, setN] = useState<number>(Number(params.get('n')) || (preset?.objective ? 10 : 20));
  const [domains, setDomains] = useState<number[]>(params.get('d') ? params.get('d')!.split(',').map(Number) : []);
  const [objective, setObjective] = useState<string>(preset?.objective ?? params.get('o') ?? 'claude-application-design');
  const [difficulty, setDifficulty] = useState<number[]>([]);
  const [queue, setQueue] = useState<Item[] | null>(null);
  const [pos, setPos] = useState(0);
  const [chosen, setChosen] = useState<string[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [conf, setConf] = useState<Conf | undefined>();
  const [results, setResults] = useState<Result[]>([]);
  const startedAt = useRef(0);
  const shownAt = useRef(0);
  const sessionId = useRef('');
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadBank().then(setBank).catch((e) => setError(String(e)));
  }, []);

  const seen = useMemo(() => new Set(attempts.map((a) => a.q)), [attempts]);
  const dueIds = useMemo(() => (hydrated ? Store.dueIds() : []), [srs, hydrated]);

  const pool = useMemo((): Question[] => {
    if (!bank) return [];
    const diff = difficulty.length ? { difficulty } : {};
    switch (mode) {
      case 'due':
        return filterBank(bank, { ids: dueIds.length ? dueIds : ['__none__'], ...diff });
      case 'domain':
        return filterBank(bank, { domains, ...diff });
      case 'objective':
        return filterBank(bank, { objectives: [objective], ...diff });
      case 'multi':
        return filterBank(bank, { type: 'multi', ...diff });
      case 'unseen':
        return filterBank(bank, { unseenOnly: true, ...diff }, seen);
      case 'weak': {
        const sizes: Record<string, number> = {};
        for (const q of bank) sizes[q.objective] = (sizes[q.objective] ?? 0) + 1;
        const m = objectiveMastery(attempts, sizes)
          .filter((o) => o.attempts > 0)
          .sort((a, b) => b.weight * (1 - b.mastery) - a.weight * (1 - a.mastery))
          .slice(0, 4)
          .map((o) => o.objective);
        return m.length ? filterBank(bank, { objectives: m, ...diff }) : [];
      }
      default:
        return filterBank(bank, diff);
    }
  }, [bank, mode, domains, objective, difficulty, dueIds, seen, attempts]);

  const start = useCallback(
    (override?: Question[]) => {
      if (!bank) return;
      const rng = Math.random;
      let picked: Question[];
      if (override) picked = shuffle(override, rng);
      else if (mode === 'weighted') picked = drawWeighted(pool, n, { rng, seen });
      else if (mode === 'due') picked = pool.slice(0, n);
      else {
        const unseenFirst = [...shuffle(pool.filter((q) => !seen.has(q.id)), rng), ...shuffle(pool.filter((q) => seen.has(q.id)), rng)];
        picked = unseenFirst.slice(0, n);
      }
      setQueue(picked.map((q) => ({ q, order: optionOrder(q, rng) })));
      setPos(0);
      setChosen([]);
      setRevealed(false);
      setConf(undefined);
      setResults([]);
      startedAt.current = Date.now();
      shownAt.current = Date.now();
      sessionId.current = `p-${Date.now()}`;
      topRef.current?.scrollIntoView({ block: 'start' });
    },
    [bank, mode, pool, n, seen]
  );

  // Deep links like /practice/?mode=due start immediately.
  const autostarted = useRef(false);
  useEffect(() => {
    if (!bank || autostarted.current || preset) return;
    if (params.get('mode')) {
      autostarted.current = true;
      if (pool.length) start();
    }
  }, [bank, pool, params, preset, start]);

  const current = queue?.[pos];
  const done = queue && pos >= queue.length;

  const toggle = (id: string) => {
    if (!current || revealed) return;
    if (current.q.type === 'single') setChosen([id]);
    else setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length >= current.q.select ? [...c.slice(1), id] : [...c, id]));
  };

  const check = () => {
    if (!current || revealed || chosen.length !== current.q.select) return;
    const ok = isCorrect(current.q, chosen);
    const ms = Date.now() - shownAt.current;
    Store.recordAnswer(current.q, ok, {
      src: mode === 'due' ? 'review' : preset ? 'objective' : 'practice',
      ms,
      sid: sessionId.current,
      conf,
    });
    setResults((r) => [...r, { q: current.q, ok, ms, conf }]);
    setRevealed(true);
  };

  const next = () => {
    if (!queue) return;
    const nextPos = pos + 1;
    setPos(nextPos);
    setChosen([]);
    setRevealed(false);
    setConf(undefined);
    shownAt.current = Date.now();
    if (nextPos >= queue.length) {
      const all = [...results];
      Store.addSession({
        id: sessionId.current,
        mode: preset?.objective ? `objective:${preset.objective}` : mode,
        label: MODES.find((m) => m.id === mode)?.title ?? mode,
        startedAt: startedAt.current,
        endedAt: Date.now(),
        correct: all.filter((r) => r.ok).length,
        total: all.length,
        ms: all.reduce((s, r) => s + r.ms, 0),
      });
    }
    topRef.current?.scrollIntoView({ block: 'start' });
  };

  // Keyboard: A-F / 1-6 choose, Enter checks then advances.
  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && (t as HTMLInputElement).type !== 'radio' && (t as HTMLInputElement).type !== 'checkbox') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      const idx = 'abcdef'.indexOf(k) >= 0 ? 'abcdef'.indexOf(k) : '123456'.indexOf(k);
      if (idx >= 0 && idx < current.order.length && !revealed) {
        e.preventDefault();
        toggle(current.order[idx]);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        revealed ? next() : check();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (error) return <div className="empty">Could not load the question bank ({error}). If you are offline, open this page once while online so it is cached.</div>;
  if (!bank) return <div className="empty">Loading question bank…</div>;

  // --------------------------------------------------------------- summary --
  if (done && queue) {
    const correct = results.filter((r) => r.ok).length;
    const byObj = new Map<string, { c: number; t: number }>();
    for (const r of results) {
      const e = byObj.get(r.q.objective) ?? { c: 0, t: 0 };
      e.t++;
      if (r.ok) e.c++;
      byObj.set(r.q.objective, e);
    }
    const misses = results.filter((r) => !r.ok).map((r) => r.q);
    const totalMs = results.reduce((s, r) => s + r.ms, 0);
    const calib = (['sure', 'unsure', 'guess'] as Conf[])
      .map((c) => ({ c, rs: results.filter((r) => r.conf === c) }))
      .filter((x) => x.rs.length);
    return (
      <div ref={topRef} className="stack">
        <div className="kpis">
          <div className="kpi is-accent"><div className="kpi-v">{Math.round((correct / Math.max(1, results.length)) * 100)}<small>%</small></div><div className="kpi-l">Accuracy</div></div>
          <div className="kpi"><div className="kpi-v">{correct}<small>/{results.length}</small></div><div className="kpi-l">Correct</div></div>
          <div className="kpi"><div className="kpi-v">{(totalMs / 60000).toFixed(1)}<small>min</small></div><div className="kpi-l">Time</div></div>
          <div className="kpi"><div className="kpi-v">{(totalMs / Math.max(1, results.length) / 60000).toFixed(2)}<small>min</small></div><div className="kpi-l">Per item (exam pace 2.26)</div></div>
        </div>
        <div className="table-wrap">
          <table className="grid-table summary-table">
            <thead><tr><th>Objective</th><th className="n">Correct</th><th className="n">Items</th></tr></thead>
            <tbody>
              {[...byObj.entries()].map(([o, s]) => (
                <tr key={o}>
                  <td><a href={`${base}objective/${o}/`}>{OBJECTIVE_BY_ID.get(o)?.name ?? o}</a></td>
                  <td className="n">{s.c}</td>
                  <td className="n">{s.t}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {calib.length > 0 && (
          <p className="muted">
            Calibration:{' '}
            {calib.map(({ c, rs }) => `${c} ${Math.round((rs.filter((r) => r.ok).length / rs.length) * 100)}% (${rs.length})`).join(' · ')}
          </p>
        )}
        <div className="btn-row">
          {misses.length > 0 && <button className="btn btn-run" onClick={() => start(misses)}>Retry {misses.length} missed</button>}
          <button className="btn btn-primary" onClick={() => start()}>New session</button>
          <button className="btn" onClick={() => setQueue(null)}>Change mode</button>
        </div>
        {misses.length > 0 && <p className="faint">Missed items are now in your spaced-repetition queue and will come back as due reviews.</p>}
      </div>
    );
  }

  // --------------------------------------------------------------- running --
  if (current && queue) {
    const answered = results.length;
    const correct = results.filter((r) => r.ok).length;
    return (
      <div ref={topRef}>
        <div className="session-bar">
          <span className="num">{pos + 1} / {queue.length}</span>
          <div className="meter"><i style={{ width: `${(pos / queue.length) * 100}%` }} /></div>
          <span className="num">{correct}/{answered} correct</span>
          <button className="btn btn-sm btn-ghost" onClick={() => setPos(queue.length)}>End session</button>
        </div>
        <QuestionCell
          q={current.q}
          order={current.order}
          chosen={chosen}
          onToggle={toggle}
          mode={revealed ? 'revealed' : 'answer'}
          index={pos}
          total={queue.length}
          base={base}
          showMeta={!preset}
          footer={
            <div className="q-actions">
              {!revealed ? (
                <>
                  <span className="conf" role="group" aria-label="How sure are you?">
                    How sure?
                    {(['sure', 'unsure', 'guess'] as Conf[]).map((c) => (
                      <button key={c} type="button" aria-pressed={conf === c} onClick={() => setConf(conf === c ? undefined : c)}>{c}</button>
                    ))}
                  </span>
                  <span className="spacer" />
                  <button className="btn btn-run" disabled={chosen.length !== current.q.select} onClick={check}>
                    Check <kbd>↵</kbd>
                  </button>
                </>
              ) : (
                <>
                  <span className="spacer" />
                  <button className="btn btn-primary" onClick={next} autoFocus>
                    {pos + 1 < queue.length ? 'Next' : 'Finish'} <kbd>↵</kbd>
                  </button>
                </>
              )}
            </div>
          }
        />
        <p className="faint" style={{ fontSize: 12.5 }}>Keys: A–D or 1–4 to choose, Enter to check and continue.</p>
      </div>
    );
  }

  // ------------------------------------------------------------------ setup --
  const available = pool.length;
  return (
    <div ref={topRef}>
      {!preset && (
        <div className="hub" role="group" aria-label="Practice mode">
          {MODES.map((m) => (
            <button key={m.id} type="button" className="mode-card" aria-pressed={mode === m.id} onClick={() => setMode(m.id)}>
              <b>{m.title}</b>
              <span>{m.blurb}</span>
              {m.id === 'due' && <span className="n">{hydrated ? `${dueIds.length} due now` : ''}</span>}
            </button>
          ))}
        </div>
      )}
      <div className="filters">
        {mode === 'domain' && !preset && (
          <fieldset className="seg" aria-label="Domains" style={{ padding: 0, margin: 0 }}>
            {DOMAINS.map((d) => (
              <button key={d.n} type="button" aria-pressed={domains.includes(d.n)} title={d.name}
                onClick={() => setDomains((x) => (x.includes(d.n) ? x.filter((y) => y !== d.n) : [...x, d.n]))}>
                D{d.n}
              </button>
            ))}
          </fieldset>
        )}
        {mode === 'objective' && !preset && (
          <label className="field">Objective
            <select value={objective} onChange={(e) => setObjective(e.target.value)}>
              {DOMAINS.map((d) => (
                <optgroup key={d.n} label={`D${d.n} · ${d.name}`}>
                  {d.objectives.map((o) => <option key={o.id} value={o.id}>{o.name} ({o.weight}%)</option>)}
                </optgroup>
              ))}
            </select>
          </label>
        )}
        <label className="field">Questions
          <select value={n} onChange={(e) => setN(Number(e.target.value))}>
            {[5, 10, 20, 30, 53, 999].map((x) => <option key={x} value={x}>{x === 999 ? 'All available' : x}</option>)}
          </select>
        </label>
        <label className="field">Difficulty
          <select value={difficulty.join(',')} onChange={(e) => setDifficulty(e.target.value ? e.target.value.split(',').map(Number) : [])}>
            <option value="">Any</option>
            <option value="1">Foundational</option>
            <option value="2">Exam-level</option>
            <option value="3">Hard</option>
            <option value="2,3">Exam-level + hard</option>
          </select>
        </label>
        <button className="btn btn-run" disabled={!available} onClick={() => start()}>
          ▶ Start {Math.min(n, available)} question{Math.min(n, available) === 1 ? '' : 's'}
        </button>
      </div>
      <p className="faint">
        {available} item{available === 1 ? '' : 's'} match this mode.
        {mode === 'due' && hydrated && dueIds.length === 0 && ' Nothing is due: answer some questions first, and misses will come back on schedule.'}
        {mode === 'weak' && available === 0 && ' Answer a few practice sessions first so weak spots can be measured.'}
      </p>
      {!preset && (
        <p className="faint" style={{ marginTop: 18 }}>
          Total bank: {bank.length} original items across {OBJECTIVES.length} objectives.
        </p>
      )}
    </div>
  );
}
