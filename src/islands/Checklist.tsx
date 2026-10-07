// Readiness checklist persisted by stable item id.
import { CHECKLIST } from '../data/checklist';
import { Store } from '../lib/store';
import { useHydrated, useStore } from '../lib/store/react';

export default function Checklist() {
  const hydrated = useHydrated();
  const saved = useStore('checklist');
  const total = CHECKLIST.reduce((s, g) => s + g.items.length, 0);
  const done = hydrated ? CHECKLIST.reduce((s, g) => s + g.items.filter((i) => saved[i.id]).length, 0) : 0;
  return (
    <div>
      <div className="session-bar">
        <span className="num">{done}/{total}</span>
        <div className="meter"><i style={{ width: `${(done / total) * 100}%` }} /></div>
        <span>{done === total ? 'Book it.' : 'Book the exam when you can do all of these without notes.'}</span>
      </div>
      {CHECKLIST.map((g) => (
        <div className="ck-group" key={g.title}>
          <h3>{g.title}</h3>
          {g.items.map((item) => (
            <label className="ck-item" key={item.id}>
              <input type="checkbox" checked={hydrated && !!saved[item.id]} onChange={(e) => Store.setChecklist(item.id, e.target.checked)} />
              <span dangerouslySetInnerHTML={{ __html: item.html }} />
            </label>
          ))}
        </div>
      ))}
    </div>
  );
}
