import { useEffect, useState } from 'react';
import { Store, type MissRecord, type MockResult } from '../lib/store';

export default function ProgressDashboard() {
  const [history, setHistory] = useState<MockResult[]>([]);
  const [confidence, setConfidence] = useState<Record<string, number>>({});
  const [due, setDue] = useState<MissRecord[]>([]);
  const [weakest, setWeakest] = useState<{ objective: string; misses: number }[]>([]);

  function refresh() {
    setHistory(Store.getMockHistory());
    setConfidence(Store.getConfidence());
    setDue(Store.dueForReview());
    setWeakest(Store.weakestObjectives(8));
  }

  useEffect(refresh, []);

  function exportProgress() {
    const blob = new Blob([Store.exportJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ccdvf-progress-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importProgress(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then((text) => {
      Store.importJSON(text);
      refresh();
    });
  }

  return (
    <div className="progress-wrap">
      <section className="prog-section">
        <h2>Weakest objectives</h2>
        <p className="ps-note">Ranked by real miss data, not by how shaky a topic feels.</p>
        {weakest.length === 0 ? (
          <p className="empty-note">No misses recorded yet — take a quiz or a mock to build this.</p>
        ) : (
          <table className="dtable">
            <thead>
              <tr><th>Objective</th><th>Misses</th><th>Self-rating</th></tr>
            </thead>
            <tbody>
              {weakest.map((w) => {
                const conf = confidence[w.objective];
                const mismatch = conf !== undefined && conf >= 4 && w.misses >= 2;
                return (
                  <tr key={w.objective}>
                    <td>{w.objective}</td>
                    <td className="num">{w.misses}</td>
                    <td className="num">
                      {conf ? `${conf}/5` : '—'}
                      {mismatch && <span className="warn-flag"> · feels strong, isn’t</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="prog-section">
        <h2>Due for review</h2>
        <p className="ps-note">Missed items resurface at 1 day, then 3, then 7.</p>
        {due.length === 0 ? (
          <p className="empty-note">Nothing due right now.</p>
        ) : (
          <table className="dtable">
            <thead>
              <tr><th>Objective</th><th>Missed</th></tr>
            </thead>
            <tbody>
              {due.map((d) => (
                <tr key={d.questionId}>
                  <td>{d.objective}</td>
                  <td className="num">{new Date(d.missedAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="prog-section">
        <h2>Mock exam history</h2>
        <p className="ps-note">Scaled scores are linear estimates, not official scoring.</p>
        {history.length === 0 ? (
          <p className="empty-note">No mocks taken yet.</p>
        ) : (
          <table className="dtable">
            <thead>
              <tr><th>Date</th><th>Raw</th><th>Est. scaled</th></tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td>{new Date(h.takenAt).toLocaleString()}</td>
                  <td className="num">{Math.round(h.scorePct * 100)}%</td>
                  <td className={h.scaledEstimate >= 720 ? 'num pass' : 'num fail'}>{h.scaledEstimate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="prog-section">
        <h2>Export &amp; import</h2>
        <p className="ps-note">
          Progress lives only in this browser. Export before clearing site data or switching machines.
        </p>
        <div className="quiz-actions">
          <button className="btn" onClick={exportProgress}>Export JSON</button>
          <label className="import-label">
            Import
            <input type="file" accept="application/json" onChange={importProgress} />
          </label>
        </div>
      </section>
    </div>
  );
}
