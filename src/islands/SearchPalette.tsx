// Full-text search over the built site using Pagefind's static index (built
// post-build into dist/pagefind and precached by the service worker, so it
// works offline). Two forms: an inline search page, and a Cmd-K / "/" palette
// mounted on every page.
import { useCallback, useEffect, useRef, useState } from 'react';

type Hit = { url: string; title: string; excerpt: string; sub?: { title: string; url: string; excerpt: string }[] };
type Pagefind = {
  options: (o: Record<string, unknown>) => Promise<void>;
  search: (q: string) => Promise<{ results: { data: () => Promise<PFData> }[] }>;
};
type PFData = {
  url: string;
  excerpt: string;
  meta: { title?: string };
  sub_results?: { title: string; url: string; excerpt: string }[];
};

let pf: Promise<Pagefind | null> | null = null;
function loadPagefind(base: string): Promise<Pagefind | null> {
  if (!pf) {
    const url = `${base}pagefind/pagefind.js`;
    pf = import(/* @vite-ignore */ url)
      .then(async (m: Pagefind) => {
        await m.options({ baseUrl: base, excerptLength: 24 });
        return m;
      })
      .catch(() => null);
  }
  return pf;
}

export default function SearchPalette({ base = '/', inline = false }: { base?: string; inline?: boolean }) {
  const [open, setOpen] = useState(inline);
  const [q, setQ] = useState(() => (inline && typeof window !== 'undefined' ? new URLSearchParams(location.search).get('q') ?? '' : ''));
  const [hits, setHits] = useState<Hit[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'unavailable'>('idle');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const seq = useRef(0);

  const show = useCallback(() => {
    setOpen(true);
    if (!inline) dialogRef.current?.showModal();
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [inline]);

  useEffect(() => {
    if (inline) return;
    const onOpen = () => show();
    window.addEventListener('ccdvf:search-open', onOpen);
    const trigger = document.querySelectorAll<HTMLAnchorElement>('[data-search-open]');
    const click = (e: Event) => {
      e.preventDefault();
      show();
    };
    trigger.forEach((t) => t.addEventListener('click', click));
    return () => {
      window.removeEventListener('ccdvf:search-open', onOpen);
      trigger.forEach((t) => t.removeEventListener('click', click));
    };
  }, [inline, show]);

  useEffect(() => {
    if (!open) return;
    const id = ++seq.current;
    if (!q.trim()) {
      setHits([]);
      return;
    }
    setState('loading');
    const t = setTimeout(async () => {
      const p = await loadPagefind(base);
      if (!p) return setState('unavailable');
      const res = await p.search(q);
      const data = await Promise.all(res.results.slice(0, 12).map((r) => r.data()));
      if (id !== seq.current) return;
      setHits(
        data.map((d) => ({
          url: d.url,
          title: d.meta.title?.replace(/ · CCDV-F Field Lab$/, '') ?? d.url,
          excerpt: d.excerpt,
          sub: d.sub_results?.filter((s) => s.url !== d.url).slice(0, 3),
        }))
      );
      setActive(0);
      setState('ready');
      if (inline) history.replaceState(null, '', `?q=${encodeURIComponent(q)}`);
    }, 140);
    return () => clearTimeout(t);
  }, [q, open, base, inline]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(hits.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter' && hits[active]) {
      location.href = hits[active].url;
    }
  };

  const body = (
    <div className="search" data-search-palette>
      <input
        ref={inputRef}
        type="search"
        className="search-input"
        placeholder="Search objectives, labs, traps…  e.g. batch custom_id, hook exit code, cache prefix"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={onKey}
        aria-label="Search"
        aria-controls="search-results"
        autoFocus={inline}
      />
      <div id="search-results" role="listbox" aria-label="Results" className="search-results">
        {state === 'unavailable' && (
          <p className="muted">Search index not available. It is built with the production site (npm run build), so it does not exist in dev.</p>
        )}
        {state === 'ready' && q && hits.length === 0 && <p className="muted">No matches for “{q}”.</p>}
        {hits.map((h, i) => (
          <a key={h.url} href={h.url} role="option" aria-selected={i === active} className={`search-hit${i === active ? ' is-active' : ''}`}>
            <span className="sh-title">{h.title}</span>
            <span className="sh-excerpt" dangerouslySetInnerHTML={{ __html: h.excerpt }} />
            {h.sub && h.sub.length > 0 && (
              <span className="sh-sub">
                {h.sub.map((s) => (
                  <span key={s.url}>§ {s.title}</span>
                ))}
              </span>
            )}
          </a>
        ))}
      </div>
      {!inline && <p className="faint search-help"><kbd>↑</kbd> <kbd>↓</kbd> to move · <kbd>↵</kbd> to open · <kbd>esc</kbd> to close</p>}
    </div>
  );

  if (inline) return body;
  return (
    <dialog ref={dialogRef} className="modal search-modal" onClose={() => setOpen(false)} onClick={(e) => e.target === dialogRef.current && dialogRef.current?.close()}>
      {open && body}
    </dialog>
  );
}
