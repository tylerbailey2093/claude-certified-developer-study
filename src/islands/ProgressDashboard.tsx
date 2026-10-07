// Progress analytics from the local attempt log. Accuracy always shows its
// denominator; mastery is recency-weighted and smoothed so one lucky answer
// does not read as 100%.
import { useMemo } from 'react';
import { DOMAINS, OBJECTIVE_BY_ID } from '../lib/blueprint';
import { objectiveMastery, readiness } from '../lib/analytics/mastery';
import { boxCounts, forecast } from '../lib/store/srs';
import { useHydrated, useStore } from '../lib/store/react';

type Props = { base?: string; poolSizes: Record<string, number> };

export default function ProgressDashboard({ base = '/', poolSizes }: Props) {
  const hydrated = useHydrated();
  const attempts = useStore('attempts');
  const srs = useStore('srs');
  const conf = useStore('confidence');
  const history = useStore('exam:history');
  const sessions = useStore('sessions');

  const mastery = useMemo(() => objectiveMastery(attempts, poolSizes), [attempts, poolSizes]);
  const r = useMemo(() => readiness(attempts, poolSizes), [attempts, poolSizes]);
  const boxes = useMemo(() => boxCounts(srs), [srs]);
  const fc = useMemo(() => (hydrated ? forecast(srs, Date.now(), 7) : []), [srs, hydrated]);

  if (!hydrated) return <div className="empty">Loading your progress…</div>;
  if (attempts.length === 0 && history.length === 0) {
    return (
      <div className="empty">
        No answers yet. Run a <a href={`${base}practice/?mode=weighted&n=10`}>Quick 10</a> or the{' '}
        <a href={`${base}exam/`}>exam simulator</a>; everything here is computed from your answers.
      </div>
    );
  }

  const byDomain = DOMAINS.map((d) => {
    const mine = attempts.filter((a) => a.d === d.n);
    return { d, n: mine.length, c: mine.reduce((s, a) => s + a.ok, 0) };
  });
  const overconfident = mastery
    .filter((m) => (conf[m.objective] ?? 0) >= 4 && m.attempts >= 3 && (m.accuracy ?? 1) < 0.7)
    .map((m) => m.objective);
  const exams = history.filter((h) => h.total > 0);
  const W = 640;
  const H = 200;
  const ex = (i: number) => 44 + (i / Math.max(1, exams.length - 1)) * (W - 64);
  const ey = (s: number) => H - 26 - ((s - 100) / 900) * (H - 46);
  const calib = (['sure', 'unsure', 'guess'] as const)
    .map((c) => ({ c, rs: attempts.filter((a) => a.conf === c) }))
    .filter((x) => x.rs.length);

  return (
    <div className="stack">
      <div className="kpis">
        <div className="kpi is-accent">
          <div className="kpi-v">{r.sufficient ? r.scaledEstimate : '—'}</div>
          <div className="kpi-l">{r.sufficient ? `Readiness ${r.band[0]}–${r.band[1]}` : 'Readiness: needs data'}</div>
        </div>
        <div className="kpi">
          <div className="kpi-v">{attempts.length}</div>
          <div className="kpi-l">Answers logged</div>
        </div>
        <div className="kpi">
          <div className="kpi-v">{Math.round((attempts.reduce((s, a) => s + a.ok, 0) / Math.max(1, attempts.length)) * 100)}<small>%</small></div>
          <div className="kpi-l">Overall accuracy</div>
        </div>
        <div className="kpi">
          <div className="kpi-v">{boxes.slice(1, 6).reduce((s, x) => s + x, 0)}</div>
          <div className="kpi-l">Cards in review · {boxes[6]} graduated</div>
        </div>
        <div className="kpi">
          <div className="kpi-v">{exams.length}</div>
          <div className="kpi-l">Exams taken</div>
        </div>
      </div>
      {!r.sufficient && <p className="faint" style={{ marginTop: -10 }}>{r.reason}.</p>}

      <div className="panel">
        <div className="panel-head">
          <h3>Mastery against exam weight</h3>
          <span className="faint">bar = smoothed, recency-weighted mastery · heaviest first</span>
        </div>
        {[...mastery].sort((a, b) => b.weight - a.weight).map((m) => {
          const o = OBJECTIVE_BY_ID.get(m.objective)!;
          return (
            <div className="bar-row" key={m.objective} data-d={o.domain}>
              <a className="lbl" href={`${base}objective/${m.objective}/`} title={o.name}>
                {o.name} <span className="faint num">{m.weight}%</span>
              </a>
              <div className="meter" title={`mastery ${Math.round(m.mastery * 100)}%`}>
                <i style={{ width: `${m.attempts ? m.mastery * 100 : 0}%` }} />
              </div>
              <span className="val">{m.attempts ? `${Math.round((m.accuracy ?? 0) * m.attempts)}/${m.attempts}` : '—'}</span>
            </div>
          );
        })}
      </div>

      <div className="split">
        <div className="panel">
          <div className="panel-head"><h3>By domain</h3></div>
          <div className="table-wrap">
            <table className="grid-table">
              <thead><tr><th>Domain</th><th className="n">Weight</th><th className="n">Correct</th><th className="n">Acc.</th></tr></thead>
              <tbody>
                {byDomain.map(({ d, n, c }) => (
                  <tr key={d.n}>
                    <td><a href={`${base}domain/${d.n}/`}>D{d.n} · {d.name}</a></td>
                    <td className="n">{d.weight}%</td>
                    <td className="n">{c}/{n}</td>
                    <td className="n">{n ? `${Math.round((c / n) * 100)}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="panel">
          <div className="panel-head"><h3>Spaced repetition</h3></div>
          {['Box 1 (1d)', 'Box 2 (2d)', 'Box 3 (4d)', 'Box 4 (8d)', 'Box 5 (16d)', 'Graduated'].map((l, i) => {
            const v = boxes[i + 1] ?? boxes[6];
            const max = Math.max(1, ...boxes);
            return (
              <div className="bar-row" key={l}>
                <span className="lbl">{l}</span>
                <div className="meter"><i style={{ width: `${(v / max) * 100}%`, background: i === 5 ? 'var(--ok)' : undefined }} /></div>
                <span className="val">{v}</span>
              </div>
            );
          })}
          <p className="muted" style={{ marginTop: 12, fontSize: 14 }}>
            Due next 7 days: {fc.map((x, i) => `${i === 0 ? 'today' : `+${i}d`} ${x}`).join(' · ')}
          </p>
          <a className="btn btn-sm btn-run" href={`${base}practice/?mode=due`}>Review due cards</a>
        </div>
      </div>

      {overconfident.length > 0 && (
        <div className="callout callout-trap">
          <p className="callout-title">Feels strong, isn't</p>
          <p>
            You rated these 4+ but are under 70% on them:{' '}
            {overconfident.map((id, i) => (
              <span key={id}>{i > 0 && ', '}<a href={`${base}objective/${id}/`}>{OBJECTIVE_BY_ID.get(id)?.name}</a></span>
            ))}
            .
          </p>
        </div>
      )}

      {calib.length > 0 && (
        <div className="panel">
          <div className="panel-head"><h3>Calibration</h3><span className="faint">accuracy by how sure you said you were</span></div>
          {calib.map(({ c, rs }) => {
            const acc = rs.reduce((s, a) => s + a.ok, 0) / rs.length;
            return (
              <div className="bar-row" key={c}>
                <span className="lbl">{c} ({rs.length})</span>
                <div className="meter"><i style={{ width: `${acc * 100}%` }} /></div>
                <span className="val">{Math.round(acc * 100)}%</span>
              </div>
            );
          })}
        </div>
      )}

      {exams.length > 0 && (
        <div className="panel">
          <div className="panel-head"><h3>Exam trend</h3><span className="faint">estimated scaled score · dashed line = 720 pass</span></div>
          <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Estimated exam scores over time">
            <line className="axis" x1={44} y1={H - 26} x2={W - 16} y2={H - 26} />
            {[100, 400, 720, 1000].map((s) => (
              <g key={s}>
                <line className={s === 720 ? '' : 'gridline'} x1={44} x2={W - 16} y1={ey(s)} y2={ey(s)} stroke={s === 720 ? 'var(--accent)' : undefined} strokeDasharray={s === 720 ? '5 4' : undefined} />
                <text x={8} y={ey(s) + 4}>{s}</text>
              </g>
            ))}
            <polyline fill="none" stroke="var(--link)" strokeWidth={2} points={exams.map((e, i) => `${ex(i)},${ey(e.scaledEstimate)}`).join(' ')} />
            {exams.map((e, i) => (
              <circle key={e.id} cx={ex(i)} cy={ey(e.scaledEstimate)} r={4} fill={e.scaledEstimate >= 720 ? 'var(--ok)' : 'var(--bad)'}>
                <title>{`${new Date(e.takenAt).toLocaleDateString()}: ${e.scaledEstimate} (${e.correct}/${e.total})`}</title>
              </circle>
            ))}
          </svg>
        </div>
      )}

      {sessions.length > 0 && (
        <div className="panel">
          <div className="panel-head"><h3>Recent practice sessions</h3></div>
          <div className="table-wrap">
            <table className="grid-table">
              <thead><tr><th>When</th><th>Mode</th><th className="n">Score</th><th className="n">Min/item</th></tr></thead>
              <tbody>
                {[...sessions].reverse().slice(0, 12).map((s) => (
                  <tr key={s.id}>
                    <td>{new Date(s.startedAt).toLocaleString()}</td>
                    <td>{s.label}</td>
                    <td className="n">{s.correct}/{s.total}</td>
                    <td className="n">{(s.ms / Math.max(1, s.total) / 60000).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <p className="faint">All data stays in this browser. Back it up from <a href={`${base}settings/`}>Settings</a>.</p>
    </div>
  );
}
