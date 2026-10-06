// rehype plugin (runs after Shiki): wraps highlighted code blocks in
// "notebook cells". Adjacent blocks in different languages (the usual
// Python + TypeScript pair) become one cell with language tabs; a single block
// becomes a cell with a fixed language tag. Copy, tab switching and the
// site-wide language preference are handled by src/scripts/cells.ts.
//
// Authors keep writing plain fenced code blocks; no MDX component needed.

const LABEL = {
  python: 'python',
  py: 'python',
  typescript: 'typescript',
  ts: 'typescript',
  javascript: 'javascript',
  js: 'javascript',
  json: 'json',
  bash: 'sh',
  sh: 'sh',
  shell: 'sh',
  yaml: 'yaml',
  toml: 'toml',
  text: 'text',
  plaintext: 'text',
};

const isWs = (n) => n.type === 'text' && !n.value.trim();
const isPre = (n) => n?.type === 'element' && n.tagName === 'pre';
const langOf = (pre) => {
  const raw = pre.properties?.dataLanguage ?? pre.properties?.['data-language'] ?? 'text';
  return LABEL[String(raw).toLowerCase()] ?? String(raw).toLowerCase();
};

const h = (tagName, properties, children = []) => ({ type: 'element', tagName, properties, children });
const t = (value) => ({ type: 'text', value });

export default function codeCells() {
  return (tree) => {
    let n = 0;
    const walk = (node) => {
      if (!node.children) return;
      const out = [];
      const kids = node.children;
      for (let i = 0; i < kids.length; i++) {
        const k = kids[i];
        if (!isPre(k)) {
          walk(k);
          out.push(k);
          continue;
        }
        // Collect a run of adjacent <pre> siblings with distinct languages.
        const group = [k];
        let j = i + 1;
        while (j < kids.length) {
          if (isWs(kids[j])) {
            j++;
            continue;
          }
          if (isPre(kids[j]) && !group.some((g) => langOf(g) === langOf(kids[j]))) {
            group.push(kids[j]);
            j++;
            continue;
          }
          break;
        }
        i = j - 1;
        n++;
        const langs = group.map(langOf);
        const id = `cell-${n}`;
        const tabs =
          group.length > 1
            ? h(
                'span',
                { className: ['cell-lang'], role: 'tablist', ariaLabel: 'Language' },
                langs.map((l, x) =>
                  h(
                    'button',
                    {
                      type: 'button',
                      role: 'tab',
                      id: `${id}-tab-${l}`,
                      ariaSelected: x === 0 ? 'true' : 'false',
                      ariaControls: `${id}-${l}`,
                      dataLang: l,
                    },
                    [t(`%${l}`)]
                  )
                )
              )
            : h('span', { className: ['cell-lang'] }, [h('span', {}, [t(`%${langs[0]}`)])]);
        const bar = h('div', { className: ['cell-bar'] }, [
          h('span', { className: ['cell-n'] }, [t(`[${n}]`)]),
          tabs,
          h('span', { className: ['cell-actions'] }, [
            h('button', { type: 'button', dataCopy: '', ariaLabel: 'Copy code' }, [t('copy')]),
          ]),
        ]);
        const panels = group.map((pre, x) =>
          h(
            'div',
            {
              className: ['cell-panel'],
              id: `${id}-${langs[x]}`,
              dataLang: langs[x],
              ...(group.length > 1 ? { role: 'tabpanel', ariaLabelledby: `${id}-tab-${langs[x]}` } : {}),
              ...(x > 0 ? { hidden: true } : {}),
            },
            [pre]
          )
        );
        out.push(h('div', { className: ['cell'], dataCell: '', dataLangs: langs.join(' ') }, [bar, ...panels]));
      }
      node.children = out;
    };
    walk(tree);
  };
}
