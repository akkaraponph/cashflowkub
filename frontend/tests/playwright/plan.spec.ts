import { api, expect, test } from './fixtures';

type Item = { id: number; name: string; planned: number; actual: number };
type Plan = { income: { items: Item[] }; expense: { items: Item[] }; savings: { items: Item[] } };
const plan = (request: Parameters<typeof api>[0], month = '2026-06') => api<Plan>(request, `/plan?month=${month}`);

test.describe('monthly plan', () => {
  test('shows the three plan sections for the month', async ({ page }) => {
    await page.goto('/plan?tab=monthly');
    for (const h of ['Income plan', 'Expense plan', 'Savings contribution plan']) await expect(page.getByRole('heading', { name: h })).toBeVisible();
    for (const n of ['Monthly salary', 'Food & Dining', 'Emergency fund']) await expect(page.getByText(n, { exact: true }).first()).toBeVisible();
  });

  test('adds, edits and deletes an income item', async ({ page, request }) => {
    await page.goto('/plan?tab=monthly');
    await page.getByRole('button', { name: 'Add plan item' }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Name').fill('Side gig');
    await dialog.getByLabel('Planned (฿)').fill('3000');
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect.poll(async () => (await plan(request)).income.items.find((i) => i.name === 'Side gig')).toMatchObject({ planned: 3000, actual: 0 });

    const row = page.getByText('Side gig', { exact: true }).locator('xpath=ancestor::*[.//button[@aria-label="Edit plan item"]][1]');
    await row.getByRole('button', { name: 'Edit plan item' }).click();
    await page.getByRole('dialog').getByLabel('Actual (฿)').fill('2500');
    await page.getByRole('dialog').getByRole('button', { name: 'Save changes' }).click();
    await expect.poll(async () => (await plan(request)).income.items.find((i) => i.name === 'Side gig')?.actual).toBe(2500);

    await row.getByRole('button', { name: 'Edit plan item' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Click again to delete this item' }).click();
    await expect.poll(async () => (await plan(request)).income.items.some((i) => i.name === 'Side gig')).toBe(false);
  });

  test('adds an expense item and a savings item to their own sections', async ({ page, request }) => {
    await page.goto('/plan?tab=monthly');
    const add = page.getByRole('button', { name: 'Add plan item' });
    await add.nth(1).click();
    await page.getByRole('dialog').getByLabel('Name').fill('Haircut');
    await page.getByRole('dialog').getByLabel('Planned (฿)').fill('300');
    await page.getByRole('dialog').getByRole('button', { name: 'Save changes' }).click();
    await expect.poll(async () => (await plan(request)).expense.items.some((i) => i.name === 'Haircut')).toBe(true);

    await add.nth(2).click();
    await page.getByRole('dialog').getByLabel('Name').fill('Wedding fund');
    await page.getByRole('dialog').getByLabel('Planned (฿)').fill('1000');
    await page.getByRole('dialog').getByRole('button', { name: 'Save changes' }).click();
    await expect.poll(async () => (await plan(request)).savings.items.some((i) => i.name === 'Wedding fund')).toBe(true);
  });

  test('shows an empty month with no NaN, and falls back from a malformed month', async ({ page }) => {
    await page.goto('/plan?tab=monthly&month=2025-01');
    await expect(page.getByText('Nothing planned here yet.')).toHaveCount(3);
    await expect(page.locator('body')).not.toContainText('NaN');
    await page.goto('/plan?tab=monthly&month=garbage');
    await expect(page.getByText('Monthly salary', { exact: true }).first()).toBeVisible();
  });

  test('compares plan with actual on the summary tab', async ({ page }) => {
    await page.goto('/plan');
    await page.getByRole('link', { name: 'Plan vs actual' }).click();
    await expect(page).toHaveURL(/tab=summary/);
    for (const t of ['Net variance', 'Income realized', 'Expense usage']) await expect(page.getByText(t).first()).toBeVisible();
  });

  test('lists asset values on the asset update tab', async ({ page }) => {
    await page.goto('/plan');
    await page.getByRole('link', { name: 'Asset update' }).click();
    await expect(page).toHaveURL(/tab=assets/);
    await expect(page.getByText('Last updated').first()).toBeVisible();
    await expect(page.getByText('Kasikorn Savings').first()).toBeVisible();
  });
});
