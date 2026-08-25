import { useEffect, useState } from 'react';
import { Store, type MissRecord, type MockResult } from '../lib/store';

export default function ProgressDashboard() {
  const [, setMisses] = useState<MissRecord[]>([]);
  const [history, setHistory] = useState<MockResult[]>([]);
  const [confidence, setConfidence] = useState<Record<string, number>>({});
  const [due, setDue] = useState<MissRecord[]>([]);

  useEffect(() => {
    setMisses(Store.getMisses());
    setHistory(Store.getMockHistory());
    setConfidence(Store.getConfidence());
    setDue(Store.dueForReview());
  }, []);

  const weakest = Store.weakestObjectives(8);

  function exportProgress() {
    const blob = new Blob([Store.exportJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `ccdvf-progress-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importProgress(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then((text) => {
      Store.importJSON(text);
      setMisses(Store.getMisses());
      setHistory(Store.getMockHistory());
      setConfidence(Store.getConfidence());
      setDue(Store.dueForReview());
    });
  }

  return (
    <div className="progress-wrap">
      <section>
        <h2>Weakest objectives (by real miss data)</h2>
        {weakest.length === 0 ? <p>No misses recorded yet — take a quiz or mock to build this.</p> : (
          <table className="mock-review-table">
            <thead><tr><th>Objective</th><th>Misses</th><th>Your confidence</th></tr></thead>
            <tbody>
              {weakest.map((w) => {
                const conf = confidence[w.objective];
                const mismatch = conf !== undefined && conf >= 4 && w.misses >= 2;
                return (
                  <tr key={w.objective}>
                    <td>{w.objective}</td>
                    <td>{w.misses}</td>
                    <td>{conf ? `${conf}/5${mismatch ? ' ⚠ feels strong, isn\'t' : ''}` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section style={{ marginTop: 28 }}>
        <h2>Due for spaced-repetition review ({due.length})</h2>
        {due.length === 0 ? <p>Nothing due right now.</p> : (
          <ul>
            {due.map((d) => <li key={d.questionId}>{d.objective} &mdash; missed {new Date(d.missedAt).toLocaleDateString()}</li>)}
          </ul>
        )}
      </section>

      <section style={{ marginTop: 28 }}>
        <h2>Mock exam history</h2>
        {history.length === 0 ? <p>No mocks taken yet.</p> : (
          <table className="mock-review-table">
            <thead><tr><th>Date</th><th>Score</th><th>Estimated scaled</th></tr></thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td>{new Date(h.takenAt).toLocaleString()}</td>
                  <td>{Math.round(h.scorePct * 100)}%</td>
                  <td className={h.scaledEstimate >= 720 ? 'pass' : 'fail'}>{h.scaledEstimate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section style={{ marginTop: 28 }}>
        <h2>Export / import</h2>
        <p>Progress lives only in this browser. Export before wiping storage or switching machines.</p>
        <button className="quiz-submit" onClick={exportProgress}>Export progress (JSON)</button>
        <label className="import-label">
          Import: <input type="file" accept="application/json" onChange={importProgress} />
        </label>
      </section>
    </div>
  );
}
