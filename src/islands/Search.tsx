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
        placeholder="Search objectives…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="search-input"
      />
      {results.length > 0 && (
        <ul className="search-results">
          {results.map((r) => (
            <li key={r.id}>
              <a href={`${baseUrl}objective/${r.id}/`}>D{r.domain} &middot; {r.name} <span style={{ opacity: 0.6 }}>{r.weight}%</span></a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
