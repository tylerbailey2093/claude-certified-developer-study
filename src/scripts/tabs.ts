// Page-level tabs (objective and domain pages). ARIA tablist pattern with
// #hash deep links (#learn, #practice, #traps...). Without JS every panel is
// shown stacked with its own heading, so nothing is ever hidden from a reader.
function init(list: HTMLElement) {
  const tabs = [...list.querySelectorAll<HTMLElement>('[role="tab"]')];
  const panels = tabs.map((t) => document.getElementById(t.getAttribute('aria-controls') ?? ''));

  function select(i: number, focus = false, updateHash = true) {
    tabs.forEach((t, x) => {
      const on = x === i;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      if (panels[x]) panels[x]!.hidden = !on;
    });
    if (focus) tabs[i].focus();
    const key = tabs[i].dataset.key;
    if (updateHash && key) history.replaceState(null, '', `#${key}`);
    window.dispatchEvent(new CustomEvent('ccdvf:tab', { detail: { key } }));
  }

  tabs.forEach((t, i) => {
    t.addEventListener('click', (e) => {
      e.preventDefault();
      select(i);
    });
    t.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        select((i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length, true);
      }
    });
  });

  const fromHash = () => {
    const key = location.hash.slice(1);
    if (!key) return -1;
    let i = tabs.findIndex((t) => t.dataset.key === key);
    if (i < 0) {
      // a deep link to a heading inside a panel: open that panel
      const target = document.getElementById(key);
      i = panels.findIndex((p) => p && target && p.contains(target));
    }
    return i;
  };
  const initial = fromHash();
  select(initial >= 0 ? initial : 0, false, false);
  if (initial >= 0) {
    const target = document.getElementById(location.hash.slice(1));
    if (target && !tabs.some((t) => t.dataset.key === location.hash.slice(1))) target.scrollIntoView();
  }
  window.addEventListener('hashchange', () => {
    const i = fromHash();
    if (i >= 0) select(i, false, false);
  });
}

document.querySelectorAll<HTMLElement>('[data-tabs]').forEach(init);
