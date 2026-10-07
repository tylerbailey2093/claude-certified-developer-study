import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// Every built HTML route renders with an h1 and no page errors, in both themes.
const dist = path.resolve(import.meta.dirname, '../../dist');
function routes(dir = dist, prefix = ''): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (['_astro', 'pagefind', 'fonts', 'icons', 'data', 'labs-nb'].includes(e.name)) continue;
      out.push(...routes(path.join(dir, e.name), `${prefix}${e.name}/`));
    } else if (e.name === 'index.html') out.push(prefix);
  }
  return out;
}
const REDIRECTS = new Set(['quiz/', 'mock/', 'logistics/']);
const all = routes().filter((r) => !REDIRECTS.has(r));

for (const theme of ['dark', 'light'] as const) {
  test(`all ${all.length} routes render (${theme})`, async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem('ccdvf:v2:prefs', JSON.stringify({ theme: t })), theme);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`${page.url()}: ${e.message}`));
    for (const r of all) {
      const res = await page.goto(r);
      expect(res?.status(), r).toBeLessThan(400);
      await expect(page.locator('h1').first(), r).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(theme);
    }
    expect(errors).toEqual([]);
  });
}

test('old routes redirect', async ({ page }) => {
  await page.goto('quiz/');
  await expect(page).toHaveURL(/\/practice\/$/);
  await page.goto('mock/');
  await expect(page).toHaveURL(/\/exam\/$/);
});
