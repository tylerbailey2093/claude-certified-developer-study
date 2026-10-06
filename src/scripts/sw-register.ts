// Registers the service worker in production builds and handles updates.
// A new version waits until the user accepts; the prompt is held back while an
// exam is running so a reload never interrupts it.
import { Workbox } from 'workbox-window';
import { Store } from '../lib/store';

const base = document.body.dataset.base ?? '/';

function toast(text: string, action?: { label: string; run: () => void }) {
  document.querySelector('.toast[data-sw]')?.remove();
  const t = document.createElement('div');
  t.className = 'toast';
  t.dataset.sw = '';
  t.setAttribute('role', 'status');
  const span = document.createElement('span');
  span.textContent = text;
  t.appendChild(span);
  if (action) {
    const b = document.createElement('button');
    b.className = 'btn btn-sm btn-primary';
    b.textContent = action.label;
    b.onclick = action.run;
    t.appendChild(b);
  }
  const x = document.createElement('button');
  x.className = 'btn btn-sm btn-ghost';
  x.textContent = 'Later';
  x.onclick = () => t.remove();
  t.appendChild(x);
  document.body.appendChild(t);
}

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const wb = new Workbox(`${base}sw.js`, { scope: base });
  let pending = false;

  const offerUpdate = () => {
    const exam = Store.activeExam();
    if (exam && !exam.submittedAt) {
      pending = true; // ask again once the exam ends
      return;
    }
    toast('A new version of the study site is ready.', {
      label: 'Reload',
      run: () => {
        wb.addEventListener('controlling', () => location.reload());
        wb.messageSkipWaiting();
      },
    });
  };

  wb.addEventListener('waiting', offerUpdate);
  wb.addEventListener('activated', (e) => {
    if (!e.isUpdate && !e.isExternal) {
      // First install: everything is now cached for offline use.
      toast('Saved for offline use. Install it from your browser menu to keep progress safe.');
      navigator.storage?.persist?.();
    }
  });
  window.addEventListener('ccdvf:store', () => {
    if (pending && !Store.activeExam()) {
      pending = false;
      offerUpdate();
    }
  });
  window.addEventListener('ccdvf:sw-check', async () => {
    try {
      await wb.update();
      toast('Checked for updates. If a new version exists you will be asked to reload.');
    } catch {
      toast('Could not reach the server to check for updates.');
    }
  });
  wb.register().catch(() => {});
}
