import { expect, test } from '@playwright/test';

test('exam: answers and flags survive reload; timeout grades the real answers', async ({ page }) => {
  await page.clock.install();
  await page.goto('exam/?seed=12345');
  await page.getByRole('button', { name: /Start/ }).first().click();
  await expect(page.getByText('Item 1 of 53')).toBeVisible();

  // answer three items, flag one
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('a');
    if (i === 1) await page.keyboard.press('f');
    await page.keyboard.press('n');
  }
  await page.clock.runFor(2000);
  await page.reload();
  await expect(page.getByText('3 answered · 1 flagged')).toBeVisible();

  // review screen reflects state
  await page.keyboard.press('r');
  await expect(page.locator('.navgrid button.is-answered')).toHaveCount(3);
  await expect(page.locator('.navgrid button.is-flagged')).toHaveCount(1);

  // jump past the absolute deadline; stepping every timer for 121 minutes is
  // slow enough to time out on CI runners. The next tick sees the deadline.
  await page.clock.fastForward(121 * 60 * 1000);
  await page.clock.runFor(2000);
  await expect(page.getByText(/time expired, answered items were scored/)).toBeVisible();
  const rec = await page.evaluate(() => JSON.parse(localStorage.getItem('ccdvf:v2:exam:history') || '[]').at(-1));
  expect(rec.reason).toBe('timeout');
  expect(rec.answered).toBe(3); // v1 bug graded 0
  expect(Object.keys(rec.answers)).toHaveLength(3);
});

test('exam: end dialog warns about unanswered items and needs two confirmations', async ({ page }) => {
  await page.goto('exam/?seed=7');
  await page.getByRole('button', { name: /Start/ }).nth(2).click(); // mini
  await page.keyboard.press('r');
  await page.getByRole('button', { name: 'End exam' }).click();
  const dlg = page.locator('dialog[open]');
  await expect(dlg).toContainText('20');
  await dlg.getByRole('button', { name: 'End exam' }).click();
  await page.getByRole('button', { name: /Yes, end and score/ }).click();
  await expect(page.getByText(/Estimated scaled score/)).toBeVisible();
});
