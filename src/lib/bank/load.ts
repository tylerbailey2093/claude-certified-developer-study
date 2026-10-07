// Runtime bank loader for islands. Memoised per page; the service worker
// serves it from cache when offline.
import type { Question } from './schema';

let pending: Promise<Question[]> | null = null;

export function loadBank(): Promise<Question[]> {
  if (!pending) {
    const url = `${import.meta.env.BASE_URL}data/bank.json`;
    pending = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`bank.json ${r.status}`);
        return r.json();
      })
      .then((j: { items: Question[] }) => j.items)
      .catch((e) => {
        pending = null; // allow a retry after a transient failure
        throw e;
      });
  }
  return pending;
}
