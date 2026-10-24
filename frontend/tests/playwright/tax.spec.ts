import { api, expect, test } from './fixtures';

test.describe('tax planner', () => {
  test('shows an estimate with the disclaimer', async ({ page }) => {
    await page.goto('/tax');
    await expect(page.getByText('Estimated tax').first()).toBeVisible();
    await expect(page.getByText('Estimate only, not tax advice', { exact: false })).toBeVisible();
    await expect(page.getByText('Tax by bracket')).toBeVisible();
  });

  test('saves real figures and recalculates', async ({ page, request }) => {
    await page.goto('/tax');
    await page.getByLabel('Salary & bonus (40(1))').fill('900000');
    await page.getByLabel('Tax already withheld').first().fill('20000');
    await page.getByLabel('Provident fund').fill('50000');
    await page.getByRole('button', { name: 'Save & recalculate' }).click();
    await expect.poll(async () => JSON.stringify(await api(request, '/tax?year=2026'))).toContain('900000');
    await expect(page.getByText('Not saved yet')).toHaveCount(0);
  });

  test('ticks a family option', async ({ page }) => {
    await page.goto('/tax');
    await page.getByLabel('Spouse with no income').check();
    await expect(page.getByLabel('Spouse with no income')).toBeChecked();
  });
});
