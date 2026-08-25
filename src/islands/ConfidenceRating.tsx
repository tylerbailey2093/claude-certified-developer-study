import { useEffect, useState } from 'react';
import { Store } from '../lib/store';

export default function ConfidenceRating({ objective }: { objective: string }) {
  const [rating, setRating] = useState<number>(0);

  useEffect(() => {
    setRating(Store.getConfidence()[objective] ?? 0);
  }, [objective]);

  function set(n: number) {
    setRating(n);
    Store.setConfidenceFor(objective, n);
  }

  return (
    <div className="confidence-rating">
      <span>Confidence:</span>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          className={n <= rating ? 'conf-dot on' : 'conf-dot'}
          onClick={() => set(n)}
          aria-label={`${n} of 5`}
        >&#9679;</button>
      ))}
    </div>
  );
}
