import { expect, test } from './fixtures';

test.describe('preferences', () => {
  test('switches the language between English and Thai', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await page.getByRole('button', { name: 'TH', exact: true }).first().click();
    await expect(page.getByText('ภาษา').first()).toBeVisible();
    await page.getByRole('button', { name: 'EN', exact: true }).first().click();
    await expect(page.getByText('Language').first()).toBeVisible();
  });

  test('toggles dark mode', async ({ page }) => {
    await page.goto('/settings');
    await page.getByRole('button', { name: 'Dark', exact: true }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.getByRole('button', { name: 'Light', exact: true }).click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });

  test('changes the financial year, which scopes the app', async ({ page }) => {
    await page.goto('/settings');
    await page.getByRole('button', { name: 'Previous year' }).first().click();
    await expect(page.getByText('2025').first()).toBeVisible();
    await page.getByRole('button', { name: 'Next year' }).first().click();
    await expect(page.getByText('2026').first()).toBeVisible();
  });

  test('toggles the language from the header on any page', async ({ page }) => {
    await page.goto('/budgets');
    await page.getByRole('button', { name: 'EN', exact: true }).click();
    await expect(page.getByRole('link', { name: 'งบประมาณ' }).first()).toBeVisible();
  });
});

test('settings offers the data download', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.getByRole('link', { name: 'Download my data' })).toHaveAttribute('href', '/api/v1/me/export');
});
