import { api, expect, test } from './fixtures';

test.describe('setup', () => {
  test('shows each setup tab', async ({ page }) => {
    await page.goto('/setup');
    await expect(page.getByText('Income items').first()).toBeVisible();
    await expect(page.getByText('Expense items').first()).toBeVisible();
    for (const [tab, text] of [
      ['channels', 'Savings & investment channels'],
      ['accounts', 'Accounts for receive / pay'],
      ['debts', 'Pay-off debts'],
      ['goals', 'Retirement'],
    ] as const) {
      await page.locator(`a[href="/setup?tab=${tab}"]`).click();
      await expect(page).toHaveURL(new RegExp(`tab=${tab}`));
      await expect(page.getByText(text).first()).toBeVisible();
    }
  });

  test('renames an expense category', async ({ page, request }) => {
    await page.goto('/setup');
    await page.getByText('Food & Dining', { exact: true }).locator('xpath=ancestor::*[.//button[@aria-label="Edit name"]][1]').getByRole('button', { name: 'Edit name' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Name').fill('Groceries');
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect.poll(async () => (await api(request, '/categories')).data.find((c: { key: string }) => c.key === 'food')?.label).toBe('Groceries');
    await expect(page.getByText('Groceries', { exact: true }).first()).toBeVisible();
  });

  test('renames an income source', async ({ page, request }) => {
    await page.goto('/setup');
    await page.getByText('Monthly salary', { exact: true }).locator('xpath=ancestor::*[.//button[@aria-label="Edit name"]][1]').getByRole('button', { name: 'Edit name' }).click();
    await page.getByRole('dialog').getByLabel('Name').fill('Salary');
    await page.getByRole('dialog').getByRole('button', { name: 'Save changes' }).click();
    await expect.poll(async () => (await api(request, '/income-categories')).data.some((c: { name: string }) => c.name === 'Salary')).toBe(true);
  });

  test('lists the seeded channels and accounts', async ({ page }) => {
    await page.goto('/setup?tab=channels');
    await expect(page.getByText('Gold savings').first()).toBeVisible();
    await page.goto('/setup?tab=accounts');
    await expect(page.getByText('Kasikorn Savings').first()).toBeVisible();
  });
});
