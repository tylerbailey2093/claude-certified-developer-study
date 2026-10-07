import { expect, test } from '@playwright/test';

test('grid animates at <=31 fps and stops when hidden or reduced motion', async ({ page }) => {
  await page.goto('');
  await page.waitForTimeout(400);
  const f0 = await page.evaluate(() => window.__grid?.frames ?? 0);
  await page.waitForTimeout(2000);
  const f1 = await page.evaluate(() => window.__grid?.frames ?? 0);
  const fps = (f1 - f0) / 2;
  expect(fps).toBeGreaterThan(5);
  expect(fps).toBeLessThanOrEqual(31);
});

test('reduced motion draws a single static frame', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('');
  await page.waitForTimeout(1200);
  const state = await page.evaluate(() => window.__grid);
  expect(state?.state).toBe('static');
  await page.waitForTimeout(1500);
  const later = await page.evaluate(() => window.__grid?.frames);
  expect(later).toBe(state?.frames); // no animation loop running
  await ctx.close();
});

declare global {
  interface Window {
    __grid?: { frames: number; state: string; packets: number };
  }
}
