// Post-build: generate dist/sw.js that precaches the entire built site (every
// page, the question bank, fonts, the Pagefind index), so an installed copy
// works with no network at all: objectives, practice, exam, labs, search.
//
// Base path: on GitHub Pages the site lives under /<repo>/, so every precache
// URL is prefixed with BASE_PATH. Query strings are ignored when matching, so
// /practice/?mode=due is served from the precached /practice/index.html.
import path from 'node:path';
import { generateSW } from 'workbox-build';

const ROOT = path.resolve(import.meta.dirname, '..');
const raw = process.env.BASE_PATH || '/';
const base = raw.endsWith('/') ? raw : `${raw}/`;

const { count, size, warnings } = await generateSW({
  globDirectory: path.join(ROOT, 'dist'),
  swDest: path.join(ROOT, 'dist/sw.js'),
  globPatterns: ['**/*.{html,js,css,woff2,json,svg,png,webmanifest,ipynb,txt}', 'pagefind/**/*'],
  globIgnores: ['sw.js', 'workbox-*.js'],
  modifyURLPrefix: { '': base },
  directoryIndex: 'index.html',
  ignoreURLParametersMatching: [/.*/],
  cleanupOutdatedCaches: true,
  clientsClaim: true,
  skipWaiting: false, // the page asks the user before activating an update
  maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
  navigateFallback: `${base}404.html`,
  navigateFallbackAllowlist: [new RegExp(`^${base.replace(/[/.]/g, '\\$&')}`)],
  inlineWorkboxRuntime: true,
  sourcemap: false,
});

for (const w of warnings) console.warn('workbox:', w);
console.log(`service worker: precached ${count} files, ${(size / 1024 / 1024).toFixed(2)} MB (base ${base})`);
