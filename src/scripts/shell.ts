// Shell behaviour shared by every page: theme and motion toggles, the mobile
// drawer (focus trap, Esc, scrim), keyboard shortcut for search, Start-menu
// badges, rail mastery dots, offline badge. Also runs the one-time store
// migration so v1 progress is carried over on first visit.
import { Store } from '../lib/store';
import { subscribe } from '../lib/store/storage';
import './cells';
import './tabs';

Store.init();
const root = document.documentElement;

// ---------------------------------------------------------------- theme --
const themeBtn = document.getElementById('theme-toggle');
function syncThemeBtn() {
  if (!themeBtn) return;
  const dark = root.dataset.theme !== 'light';
  themeBtn.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
  themeBtn.innerHTML = dark
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
}
themeBtn?.addEventListener('click', () => {
  const next = root.dataset.theme === 'light' ? 'dark' : 'light';
  root.dataset.theme = next;
  Store.setPrefs({ theme: next });
  syncThemeBtn();
});
syncThemeBtn();

// --------------------------------------------------------------- motion --
const motionBtn = document.getElementById('motion-toggle');
function syncMotion() {
  const off = Store.get('prefs').motion === 'off';
  motionBtn?.setAttribute('aria-pressed', off ? 'false' : 'true');
  motionBtn?.setAttribute('title', off ? 'Background animation: off' : 'Background animation: on');
}
motionBtn?.addEventListener('click', () => {
  const off = Store.get('prefs').motion === 'off';
  Store.setPrefs({ motion: off ? 'auto' : 'off' });
  syncMotion();
});
syncMotion();

// --------------------------------------------------------------- drawer --
const rail = document.getElementById('rail');
const scrim = document.getElementById('scrim');
const menuBtn = document.getElementById('menu-btn');
const main = document.querySelector('.main') as HTMLElement | null;
const mobile = window.matchMedia('(max-width: 940px)');

function setNav(open: boolean) {
  document.body.classList.toggle('nav-open', open);
  menuBtn?.setAttribute('aria-expanded', String(open));
  if (scrim) scrim.hidden = !open;
  if (main) main.inert = open;
  if (open) (rail?.querySelector('a, button, summary') as HTMLElement | null)?.focus();
  else if (mobile.matches) menuBtn?.focus();
}
menuBtn?.addEventListener('click', () => setNav(!document.body.classList.contains('nav-open')));
scrim?.addEventListener('click', () => setNav(false));
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.body.classList.contains('nav-open')) setNav(false);
  if (e.key === 'Tab' && document.body.classList.contains('nav-open') && rail) {
    const f = [...rail.querySelectorAll<HTMLElement>('a[href], button, summary')].filter((x) => x.offsetParent);
    if (!f.length) return;
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      last.focus();
      e.preventDefault();
    } else if (!e.shiftKey && document.activeElement === last) {
      first.focus();
      e.preventDefault();
    }
  }
});
mobile.addEventListener?.('change', () => mobile.matches || setNav(false));

// ----------------------------------------------------------- start menu --
const start = document.getElementById('start-menu') as HTMLDetailsElement | null;
document.addEventListener('click', (e) => {
  if (start?.open && !(e.target as Element).closest('#start-menu')) start.open = false;
});

// --------------------------------------------------- search shortcut "/" --
document.addEventListener('keydown', (e) => {
  const t = e.target as HTMLElement;
  const typing = t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
  if (typing || e.metaKey || e.ctrlKey || e.altKey) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openSearch();
    }
    return;
  }
  if (e.key === '/') {
    e.preventDefault();
    openSearch();
  }
});
function openSearch() {
  window.dispatchEvent(new CustomEvent('ccdvf:search-open'));
  if (!document.querySelector('[data-search-palette]')) {
    location.href = `${document.body.dataset.base ?? '/'}search/`;
  }
}

// ----------------------------------------- badges, dots, resume, offline --
function refreshBadges() {
  const due = Store.dueIds().length;
  document.querySelectorAll<HTMLElement>('[data-due-count]').forEach((el) => {
    el.textContent = due ? String(due) : '';
  });
  const active = Store.activeExam();
  document.querySelectorAll<HTMLElement>('[data-resume-exam]').forEach((el) => {
    el.hidden = !(active && !active.submittedAt);
  });
  const recent = new Map<string, number[]>();
  for (const a of Store.get('attempts')) {
    const arr = recent.get(a.o) ?? [];
    arr.push(a.ok);
    if (arr.length > 20) arr.shift();
    recent.set(a.o, arr);
  }
  document.querySelectorAll<HTMLElement | SVGElement>('.mastery-dot[data-obj], [data-dag-obj]').forEach((el) => {
    const id = el.dataset.obj ?? el.dataset.dagObj!;
    const arr = recent.get(id) ?? [];
    if (arr.length < 3) {
      el.removeAttribute('data-m');
      if (el instanceof HTMLElement) el.title = 'Not enough answers yet';
      return;
    }
    const acc = arr.reduce((s, x) => s + x, 0) / arr.length;
    el.dataset.m = acc < 0.6 ? '1' : acc < 0.8 ? '2' : '3';
    if (el instanceof HTMLElement) el.title = `Recent accuracy ${Math.round(acc * 100)}% over ${arr.length} answers`;
  });
}
refreshBadges();
subscribe(refreshBadges);

function syncOnline() {
  root.classList.toggle('is-offline', !navigator.onLine);
}
window.addEventListener('online', syncOnline);
window.addEventListener('offline', syncOnline);
syncOnline();

// Surface storage failures instead of losing progress silently.
window.addEventListener('ccdvf:store-error', () => {
  if (document.querySelector('.toast[data-store-error]')) return;
  const t = document.createElement('div');
  t.className = 'toast';
  t.dataset.storeError = '';
  t.setAttribute('role', 'alert');
  t.textContent = 'Progress could not be saved to this browser (storage full or blocked). Export a backup from Settings.';
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 9000);
});
