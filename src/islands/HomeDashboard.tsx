// Home dashboard: readiness band, due reviews, next-up objectives, resume
// exam, recent exams. Everything derives from the local attempt log.
import { useMemo } from 'react';
import { OBJECTIVE_BY_ID, EXAM } from '../lib/blueprint';
import { readiness, nextUp } from '../lib/analytics/mastery';
import { due } from '../lib/store/srs';
import { useHydrated, useStore } from '../lib/store/react';

type Props = { base?: string; poolSizes: Record<string, number>; bankSize: number };

export default function HomeDashboard({ base = '/', poolSizes, bankSize }: Props) {
  const hydrated = useHydrated();
  const attempts = useStore('attempts');
  const srs = useStore('srs');
  const active = useStore('exam:active');
  const history = useStore('exam:history');
  const prefs = useStore('prefs');

  const r = useMemo(() => readiness(attempts, poolSizes), [attempts, poolSizes]);
  const dueIds = useMemo(() => (hydrated ? due(srs, Date.now()) : []), [srs, hydrated]);
  const dueByObj = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of attempts) if (dueIds.includes(a.q)) m[a.o] = 1;
    return m;
  }, [attempts, dueIds]);
  const up = useMemo(() => nextUp(r.objectives, dueByObj, 3), [r, dueByObj]);
  const daysLeft = prefs.examDate ? Math.ceil((Date.parse(prefs.examDate + 'T09:00:00') - Date.now()) / 86400000) : null;
  const last = history[history.length - 1];
  const accuracy = attempts.length ? Math.round((attempts.reduce((s, a) => s + a.ok, 0) / attempts.length) * 100) : null;

  if (!hydrated) return <div className="kpis" aria-busy="true" style={{ minHeight: 96 }} />;

  return (
    <div className="stack">
      {active && !active.submittedAt && (
        <div className="callout callout-key">
          <p className="callout-title">Exam in progress</p>
          <p>
            You have a {active.mode} exam running ({Object.keys(active.answers).length}/{active.items.length} answered).{' '}
            <a href={`${base}exam/`}>Resume it</a>; the timer has kept running.
          </p>
        </div>
      )}
      <div className="kpis">
        <div className="kpi is-accent">
          <div className="kpi-v">{r.sufficient ? r.scaledEstimate : '—'}</div>
          <div className="kpi-l">{r.sufficient ? `Readiness est. (${r.band[0]}–${r.band[1]})` : 'Readiness: needs data'}</div>
        </div>
        <div className="kpi">
          <div className="kpi-v">{dueIds.length}</div>
          <div className="kpi-l">Due reviews</div>
        </div>
        <div className="kpi">
          <div className="kpi-v">{accuracy ?? '—'}{accuracy !== null && <small>%</small>}</div>
          <div className="kpi-l">{attempts.length} answers logged</div>
        </div>
        <div className="kpi">
          <div className="kpi-v">{last ? last.scaledEstimate : '—'}</div>
          <div className="kpi-l">Last exam est. (pass {EXAM.cut})</div>
        </div>
        <div className="kpi">
          <div className="kpi-v">{daysLeft !== null ? Math.max(0, daysLeft) : '—'}</div>
          <div className="kpi-l">{daysLeft !== null ? 'Days to exam' : <a href={`${base}settings/`}>Set exam date</a>}</div>
        </div>
      </div>
      {!r.sufficient && <p className="faint" style={{ marginTop: -10 }}>{r.reason}. Practice across objectives to unlock the estimate.</p>}

      <div className="split">
        <div className="panel">
          <div className="panel-head"><h3>Next up</h3><span className="faint">weight × weakness</span></div>
          {attempts.length === 0 ? (
            <p className="muted">
              Start with <a href={`${base}objective/claude-application-design/`}>Claude Application Design</a>: at 8.6% it is the heaviest objective
              on the exam and has no dedicated lesson in the official course.
            </p>
          ) : (
            <ol style={{ margin: 0, paddingLeft: 18 }}>
              {up.map((o) => (
                <li key={o.objective} style={{ margin: '8px 0' }}>
                  <a href={`${base}objective/${o.objective}/`}>{OBJECTIVE_BY_ID.get(o.objective)?.name}</a>{' '}
                  <span className="faint num">
                    {o.weight}% · mastery {Math.round(o.mastery * 100)}%{o.attempts ? ` · ${o.attempts} answers` : ' · untested'}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
        <div className="panel">
          <div className="panel-head"><h3>Quick start</h3></div>
          <div className="btn-row">
            <a className="btn btn-run" href={`${base}practice/?mode=weighted&n=10`}>▶ Quick 10</a>
            <a className="btn" href={`${base}practice/?mode=due`} aria-disabled={dueIds.length === 0}>Due reviews ({dueIds.length})</a>
            <a className="btn" href={`${base}exam/`}>Exam simulator</a>
          </div>
          <p className="faint" style={{ fontSize: 13, margin: '12px 0 0' }}>
            {bankSize} original items. Every answer feeds spaced repetition; misses come back at 1, 2, 4, 8 and 16 days.
          </p>
        </div>
      </div>
    </div>
  );
}
