// Vanilla-JS handler for the legacy codeblock() markup (language tabs + copy button).
// Ported from legacy/guide/ccdv-f-glass.html — modernised only in the copy path
// (Clipboard API instead of the deprecated execCommand hack).
document.addEventListener('click', (e) => {
  const lg = e.target.closest('.lg');
  if (lg) {
    const cb = lg.dataset.cb;
    document.querySelectorAll(`.lg[data-cb="${cb}"]`).forEach((b) => b.classList.toggle('on', b === lg));
    document.querySelectorAll(`pre[id^="${cb}-"]`).forEach((p) => { p.hidden = p.id !== `${cb}-${lg.dataset.k}`; });
    return;
  }
  const cp = e.target.closest('.cp');
  if (cp) {
    const vis = [...document.querySelectorAll(`pre[id^="${cp.dataset.cb}-"]`)].find((p) => !p.hidden);
    if (vis) {
      const raw = vis.getAttribute('data-raw').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
      navigator.clipboard?.writeText(raw).catch(() => {});
      cp.textContent = 'copied';
      cp.classList.add('done');
      setTimeout(() => { cp.textContent = 'copy'; cp.classList.remove('done'); }, 1400);
    }
  }
});
