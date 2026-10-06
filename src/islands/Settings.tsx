// Preferences, backup/restore, storage and app-version controls.
import { useEffect, useRef, useState } from 'react';
import { Store } from '../lib/store';
import { useHydrated, useStore } from '../lib/store/react';

export default function Settings() {
  const hydrated = useHydrated();
  const prefs = useStore('prefs');
  const meta = useStore('meta');
  const attempts = useStore('attempts');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [usage, setUsage] = useState('');
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    navigator.storage?.estimate?.().then((e) => {
      if (e.usage !== undefined) setUsage(`${(e.usage / 1024 / 1024).toFixed(1)} MB used${e.quota ? ` of ${(e.quota / 1024 / 1024 / 1024).toFixed(1)} GB` : ''}`);
    });
    navigator.storage?.persisted?.().then(setPersisted);
  }, []);

  if (!hydrated) return <div className="empty">Loading settings…</div>;

  const setTheme = (t: 'dark' | 'light') => {
    document.documentElement.dataset.theme = t;
    Store.setPrefs({ theme: t });
  };

  const download = () => {
    const blob = new Blob([Store.exportJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ccdvf-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    setMsg({ ok: true, text: 'Backup downloaded.' });
  };

  const upload = async (f: File) => {
    const res = Store.importJSON(await f.text());
    setMsg(res.ok ? { ok: true, text: res.summary } : { ok: false, text: res.error });
  };

  const lastExport = meta.lastExportAt ? new Date(meta.lastExportAt).toLocaleDateString() : 'never';

  return (
    <div className="stack">
      <div className="panel">
        <div className="panel-head"><h3>Appearance</h3></div>
        <div className="filters" style={{ marginBottom: 0 }}>
          <label className="field">Theme
            <span className="seg">
              {(['dark', 'light'] as const).map((t) => (
                <button key={t} type="button" aria-pressed={(prefs.theme ?? 'dark') === t} onClick={() => setTheme(t)}>{t}</button>
              ))}
            </span>
          </label>
          <label className="field">Background animation
            <span className="seg">
              {(['auto', 'off'] as const).map((m) => (
                <button key={m} type="button" aria-pressed={(prefs.motion ?? 'auto') === m} onClick={() => Store.setPrefs({ motion: m })}>
                  {m === 'auto' ? 'on' : 'off'}
                </button>
              ))}
            </span>
          </label>
          <label className="field">Code examples
            <span className="seg">
              {(['python', 'typescript'] as const).map((l) => (
                <button key={l} type="button" aria-pressed={(prefs.codeLang ?? 'python') === l} onClick={() => Store.setPrefs({ codeLang: l })}>{l}</button>
              ))}
            </span>
          </label>
        </div>
        <p className="faint" style={{ fontSize: 13, margin: '12px 0 0' }}>The animation always stops when your system asks for reduced motion, and during a running exam.</p>
      </div>

      <div className="panel">
        <div className="panel-head"><h3>Exam date</h3></div>
        <label className="field" style={{ maxWidth: 260 }}>
          Booked for
          <input type="date" value={prefs.examDate ?? ''} onChange={(e) => Store.setPrefs({ examDate: e.target.value || undefined })} />
        </label>
        <p className="faint" style={{ fontSize: 13, margin: '10px 0 0' }}>
          With a date set, review intervals shrink so every missed item comes back at least once before exam day.
        </p>
      </div>

      <div className="panel">
        <div className="panel-head"><h3>Backup and restore</h3><span className="faint">last backup: {lastExport}</span></div>
        <p className="muted">
          Progress ({attempts.length} answers) lives only in this browser. Browsers can clear it, especially Safari for sites you have not
          visited in a week unless the app is installed. Download a backup now and then.
        </p>
        <div className="btn-row">
          <button className="btn btn-primary" onClick={download}>Download backup</button>
          <button className="btn" onClick={() => fileRef.current?.click()}>Restore from file…</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </div>
        {msg && <p role="status" style={{ color: msg.ok ? 'var(--ok)' : 'var(--bad)', marginTop: 12 }}>{msg.text}</p>}
        <p className="faint" style={{ fontSize: 13 }}>Restoring merges into what is here; it never deletes newer progress. Old v1 backups are accepted.</p>
      </div>

      <div className="panel">
        <div className="panel-head"><h3>Storage and app</h3></div>
        <p className="muted" style={{ marginBottom: 6 }}>{usage || 'Storage estimate unavailable.'}</p>
        <p className="muted">
          Persistent storage: {persisted === null ? 'unknown' : persisted ? 'granted' : 'not granted'}{' '}
          {persisted === false && (
            <button className="btn btn-sm" onClick={() => navigator.storage?.persist?.().then(setPersisted)}>Request</button>
          )}
        </p>
        <div className="btn-row">
          <button className="btn" onClick={() => window.dispatchEvent(new CustomEvent('ccdvf:sw-check'))}>Check for updates</button>
          {!confirmReset ? (
            <button className="btn btn-ghost" onClick={() => setConfirmReset(true)}>Reset all progress…</button>
          ) : (
            <>
              <span className="muted">This deletes every answer, card and exam in this browser.</span>
              <button className="btn" onClick={() => setConfirmReset(false)}>Cancel</button>
              <button className="btn btn-run" onClick={() => { Store.reset(); Store.init(); setConfirmReset(false); setMsg({ ok: true, text: 'Progress reset.' }); }}>Delete everything</button>
            </>
          )}
        </div>
        <p className="faint mono" style={{ fontSize: 12, marginTop: 12 }}>build {document.body.dataset.build}</p>
      </div>
    </div>
  );
}
