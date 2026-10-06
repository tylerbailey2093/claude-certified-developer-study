// Size budget for the built site. The whole thing is precached for offline
// use, so bloat costs every learner storage and first-install time.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { ROOT } from './lib/load.ts';

const DIST = path.join(ROOT, 'dist');
const MB = 1024 * 1024;
const fails: string[] = [];
const gz = (f: string) => zlib.gzipSync(fs.readFileSync(f)).length;

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}
if (!fs.existsSync(DIST)) {
  console.error('dist/ missing: run npm run build first');
  process.exit(1);
}
const files = walk(DIST);
const total = files.reduce((s, f) => s + fs.statSync(f).size, 0);
const bank = path.join(DIST, 'data/bank.json');
const bankGz = fs.existsSync(bank) ? gz(bank) : 0;
const gridJs = files.filter((f) => /_astro\/.*\.js$/.test(f) && fs.readFileSync(f, 'utf8').includes('lakehouse-grid'));
const islands = files.filter((f) => /_astro\/.*\.js$/.test(f)).map((f) => ({ f, gz: gz(f) }));
const biggest = islands.sort((a, b) => b.gz - a.gz)[0];

const report = {
  totalMB: +(total / MB).toFixed(2),
  bankGzKB: Math.round(bankGz / 1024),
  largestChunk: biggest ? `${path.basename(biggest.f)} ${Math.round(biggest.gz / 1024)} KB gz` : 'none',
};
console.log(JSON.stringify(report));
if (total > 15 * MB) fails.push(`site is ${report.totalMB} MB (budget 15 MB precache)`);
if (bankGz > 350 * 1024) fails.push(`bank.json is ${report.bankGzKB} KB gz (budget 350)`);
if (biggest && biggest.gz > 120 * 1024) fails.push(`chunk ${path.basename(biggest.f)} is ${Math.round(biggest.gz / 1024)} KB gz (budget 120)`);
void gridJs;
if (fails.length) {
  console.error('FAIL:\n  ' + fails.join('\n  '));
  process.exit(1);
}
console.log('PASS: size budget');
