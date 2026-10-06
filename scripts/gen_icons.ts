// One-time: rasterise public/icons/icon.svg into the PNG sizes the web app
// manifest and iOS need. The PNGs are committed; rerun only if the SVG changes.
//   npx tsx scripts/gen_icons.ts
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(import.meta.dirname, '..');
const svg = fs.readFileSync(path.join(ROOT, 'public/icons/icon.svg'), 'utf8');
const exe = process.env.PW_CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const targets: { file: string; size: number; padding: number }[] = [
  { file: 'icon-192.png', size: 192, padding: 0 },
  { file: 'icon-512.png', size: 512, padding: 0 },
  { file: 'maskable-512.png', size: 512, padding: 0.12 }, // safe zone for adaptive icons
  { file: 'apple-touch-icon.png', size: 180, padding: 0 },
];

const browser = await chromium.launch(fs.existsSync(exe) ? { executablePath: exe } : {});
for (const t of targets) {
  const page = await browser.newPage({ viewport: { width: t.size, height: t.size } });
  const inner = Math.round(t.size * (1 - 2 * t.padding));
  await page.setContent(
    `<html><body style="margin:0;background:#0B2026;display:grid;place-items:center;width:${t.size}px;height:${t.size}px">` +
      `<div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div></body></html>`
  );
  await page.screenshot({ path: path.join(ROOT, 'public/icons', t.file), omitBackground: false });
  await page.close();
  console.log('wrote', t.file);
}
await browser.close();
