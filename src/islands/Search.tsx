import { useMemo, useState } from 'react';

type ObjectiveIndexEntry = { id: string; name: string; domain: number; weight: number };

export default function Search({ index, baseUrl }: { index: ObjectiveIndexEntry[]; baseUrl: string }) {
  const [q, setQ] = useState('');

  const results = useMemo(() => {
    if (q.trim().length < 2) return [];
    const needle = q.toLowerCase();
    return index.filter((o) => o.name.toLowerCase().includes(needle)).slice(0, 8);
  }, [q, index]);

  return (
    <div className="search-wrap">
      <input
        type="search"
        placeholder="Search the 25 objectives…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="search-input"
        aria-label="Search objectives"
      />
      {results.length > 0 && (
        <ul className="search-results">
          {results.map((r) => (
            <li key={r.id}>
              <a href={`${baseUrl}objective/${r.id}/`}>
                <span>D{r.domain} · {r.name}</span>
                <span className="sr-w">{r.weight}%</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
