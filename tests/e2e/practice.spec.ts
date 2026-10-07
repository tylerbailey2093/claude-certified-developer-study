import { expect, test } from '@playwright/test';

test('practice: answer, see rationale, attempt is logged, summary appears', async ({ page }) => {
  await page.goto('practice/?mode=weighted&n=5');
  for (let i = 0; i < 5; i++) {
    await page.locator('.q-opt-main').first().click();
    const q = page.locator('.q');
    if ((await q.getAttribute('class'))?.includes('multi')) await page.locator('.q-opt-main').nth(1).click();
    const check = page.getByRole('button', { name: /Check/ });
    if (await check.isDisabled()) await page.locator('.q-opt-main').nth(1).click();
    await check.click();
    await expect(page.locator('.q-explain')).toBeVisible();
    await page.getByRole('button', { name: /Next|Finish/ }).click();
  }
  await expect(page.getByText('Accuracy')).toBeVisible();
  const attempts = await page.evaluate(() => JSON.parse(localStorage.getItem('ccdvf:v2:attempts') || '[]').length);
  expect(attempts).toBe(5);
});

test('objective page tabs deep-link and embed practice', async ({ page }) => {
  await page.goto('objective/claude-application-design/#practice');
  await expect(page.locator('#panel-practice')).toBeVisible();
  await expect(page.locator('#panel-learn')).toBeHidden();
  await page.getByRole('tab', { name: /Learn/ }).click();
  await expect(page.locator('#panel-learn')).toBeVisible();
  expect(page.url()).toContain('#learn');
});
