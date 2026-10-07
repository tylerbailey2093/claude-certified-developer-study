import { expect, test } from '@playwright/test';

test('installed copy works fully offline', async ({ page, context }) => {
  await page.goto('');
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null || false, null, { timeout: 30_000 }).catch(() => {});
  // wait for the service worker to finish precaching and take control
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
    return !!reg.active;
  });
  await context.setOffline(true);
  for (const r of ['objective/claude-hooks/', 'practice/?mode=weighted&n=5', 'exam/', 'strategy/', 'domain/2/']) {
    await page.goto(r);
    await expect(page.locator('h1').first()).toBeVisible();
  }
  await page.goto('practice/?mode=weighted&n=5');
  await expect(page.locator('.q-opt-main').first()).toBeVisible(); // bank.json served from cache
  await page.goto('search/?q=batch');
  await expect(page.locator('.search-hit').first()).toBeVisible({ timeout: 15_000 });
  await context.setOffline(false);
});
