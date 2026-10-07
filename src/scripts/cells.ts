// Notebook-cell behaviour: language tabs (one site-wide preference switches
// every cell on the page), copy-to-clipboard, and Run-to-reveal outputs.
import { Store } from '../lib/store';

function applyLang(lang: string) {
  document.querySelectorAll<HTMLElement>('[data-cell]').forEach((cell) => {
    const langs = (cell.dataset.langs ?? '').split(' ');
    if (langs.length < 2 || !langs.includes(lang)) return;
    cell.querySelectorAll<HTMLElement>('.cell-panel').forEach((p) => (p.hidden = p.dataset.lang !== lang));
    cell
      .querySelectorAll<HTMLButtonElement>('[role="tab"]')
      .forEach((b) => b.setAttribute('aria-selected', String(b.dataset.lang === lang)));
  });
}

const pref = Store.get('prefs').codeLang;
if (pref) applyLang(pref);

document.addEventListener('click', async (e) => {
  const el = e.target as HTMLElement;
  const tab = el.closest<HTMLButtonElement>('.cell [role="tab"]');
  if (tab?.dataset.lang) {
    const lang = tab.dataset.lang;
    applyLang(lang);
    if (lang === 'python' || lang === 'typescript') Store.setPrefs({ codeLang: lang });
    return;
  }
  const copy = el.closest<HTMLButtonElement>('[data-copy]');
  if (copy) {
    const cell = copy.closest('[data-cell]');
    const panel = [...(cell?.querySelectorAll<HTMLElement>('.cell-panel') ?? [])].find((p) => !p.hidden);
    const text = panel?.querySelector('pre')?.innerText ?? '';
    try {
      await navigator.clipboard.writeText(text);
      copy.textContent = 'copied';
    } catch {
      copy.textContent = 'select + copy';
    }
    setTimeout(() => (copy.textContent = 'copy'), 1400);
    return;
  }
  const run = el.closest<HTMLButtonElement>('[data-run]');
  if (run) {
    const out = document.getElementById(run.getAttribute('aria-controls') ?? '');
    if (out) {
      out.hidden = !out.hidden;
      run.setAttribute('aria-expanded', String(!out.hidden));
      run.textContent = out.hidden ? '▶ run' : '■ hide';
    }
  }
});

// Arrow-key navigation inside a cell's tablist.
document.addEventListener('keydown', (e) => {
  const tab = (e.target as HTMLElement).closest<HTMLButtonElement>('.cell [role="tab"]');
  if (!tab || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return;
  const tabs = [...tab.parentElement!.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  const i = tabs.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : -1);
  const next = tabs[(i + tabs.length) % tabs.length];
  next.focus();
  next.click();
});
