// Self-rated confidence per objective (1-5), keyed by objective id. The
// progress page sets this against measured accuracy to find "feels strong,
// isn't" objectives.
import { Store } from '../lib/store';
import { useHydrated, useStore } from '../lib/store/react';

const LABELS = ['', 'Lost', 'Shaky', 'Okay', 'Solid', 'Could teach it'];

export default function ConfidenceRating({ objective }: { objective: string }) {
  const hydrated = useHydrated();
  const conf = useStore('confidence');
  const value = hydrated ? conf[objective] : undefined;
  return (
    <div className="panel">
      <div className="panel-head">
        <h3>How confident are you on this objective?</h3>
        <span className="muted">{value ? LABELS[value] : 'Not rated'}</span>
      </div>
      <div className="rating" role="group" aria-label="Confidence from 1 to 5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" aria-pressed={value === n} title={LABELS[n]} onClick={() => Store.setConfidence(objective, n)}>
            {n}
          </button>
        ))}
      </div>
      <p className="faint" style={{ fontSize: 13, margin: '10px 0 0' }}>
        Compared against your measured accuracy on the Progress page.
      </p>
    </div>
  );
}
