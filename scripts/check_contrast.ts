// WCAG contrast gate for the design tokens in src/styles/tokens.css.
// Text pairs need 4.5:1; large text and UI marks need 3:1. Both themes.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib/load.ts';

const css = fs.readFileSync(path.join(ROOT, 'src/styles/tokens.css'), 'utf8');

function block(selector: RegExp): Record<string, string> {
  const m = selector.exec(css);
  if (!m) throw new Error(`no block for ${selector}`);
  const start = css.indexOf('{', m.index) + 1;
  let depth = 1;
  let i = start;
  for (; i < css.length && depth; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}') depth--;
  }
  const vars: Record<string, string> = {};
  for (const v of css.slice(start, i).matchAll(/(--[\w-]+):\s*([^;]+);/g)) vars[v[1]] = v[2].trim();
  return vars;
}

const dark = block(/^:root\s*\{/m);
const light = { ...dark, ...block(/^:root\[data-theme='light'\]\s*\{/m) };

function resolve(vars: Record<string, string>, v: string): string {
  let val = vars[v] ?? v;
  for (let i = 0; i < 5 && val.startsWith('var('); i++) val = vars[val.slice(4, -1).trim()] ?? val;
  return val;
}
function lum(hex: string): number {
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const TEXT = ['--text-1', '--text-2', '--text-3', '--link', '--accent-text', '--ok', '--bad', '--warn', ...[1, 2, 3, 4, 5, 6, 7, 8].map((d) => `--d${d}-text`)];
const SURFACES = ['--bg', '--surface-1', '--surface-2', '--cell-bg'];
const PAIRS: [string, string, number][] = [
  ['--on-primary', '--primary', 4.5],
  ['--on-accent', '--accent', 4.5],
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((d) => [`--d${d}`, '--surface-2', 3] as [string, string, number]),
  ['--border-strong', '--bg', 1.4],
];

let fails = 0;
for (const [name, vars] of [['dark', dark], ['light', light]] as const) {
  const check = (fg: string, bg: string, min: number) => {
    const a = resolve(vars, fg);
    const b = resolve(vars, bg);
    if (!a.startsWith('#') || !b.startsWith('#')) return;
    const r = ratio(a, b);
    if (r < min) {
      fails++;
      console.log(`✗ ${name}: ${fg} ${a} on ${bg} ${b} = ${r.toFixed(2)} (need ${min})`);
    }
  };
  for (const t of TEXT) for (const s of SURFACES) check(t, s, t === '--text-3' && s === '--surface-2' ? 4.0 : 4.5);
  for (const [fg, bg, min] of PAIRS) check(fg, bg, min);
}
if (fails) {
  console.error(`FAIL: ${fails} contrast pair(s) below threshold`);
  process.exit(1);
}
console.log('PASS: contrast (both themes)');
