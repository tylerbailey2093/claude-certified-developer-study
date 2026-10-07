import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const fixture = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../fixtures/v1-localstorage.json'), 'utf8'));

test('v1 progress is migrated on first visit', async ({ page }) => {
  await page.addInitScript((f: Record<string, unknown>) => {
    if (localStorage.getItem('__seeded')) return;
    for (const [k, v] of Object.entries(f)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
    localStorage.setItem('__seeded', '1');
  }, fixture);
  await page.goto('progress/');
  await expect(page.getByText('Answers logged')).toBeVisible();
  const srs = await page.evaluate(() => JSON.parse(localStorage.getItem('ccdvf:v2:srs') || '{}'));
  expect(Object.keys(srs)).toContain('legacy-001');
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
});
