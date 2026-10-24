import { expect, test } from './fixtures';

test.describe('dashboard', () => {
  test('summarises net worth, cashflow, bills, debts and goals', async ({ page }) => {
    await page.goto('/dashboard');
    for (const t of ['Net worth', 'Cashflow', 'Spending by category', 'Budgets', 'Savings goals', 'Recent transactions', 'Debt service ratio (DSR)']) {
      await expect(page.getByText(t).first()).toBeVisible();
    }
  });

  test('links through to the detailed pages', async ({ page }) => {
    for (const [href, url] of [['/transactions', /\/transactions/], ['/debts', /\/debts/], ['/networth', /\/networth/], ['/goals', /\/goals/], ['/budgets', /\/budgets/]] as const) {
      await page.goto('/dashboard');
      await page.locator(`a[href="${href}"]`).filter({ hasText: 'View all' }).first().click();
      await expect(page).toHaveURL(url);
    }
  });

  test('navigates every screen from the sidebar', async ({ page }) => {
    await page.goto('/dashboard');
    for (const [name, url] of [
      ['Transactions', /\/transactions/], ['Bills', /\/bills/], ['Debts', /\/debts/], ['Net worth', /\/networth/], ['Budgets', /\/budgets/],
      ['Accounts', /\/accounts/], ['Reports', /\/reports/], ['Goals', /\/goals/], ['Plan', /\/plan/], ['Tax', /\/tax/], ['Setup', /\/setup/], ['Settings', /\/settings/],
    ] as const) {
      await page.getByRole('link', { name, exact: true }).first().click();
      await expect(page).toHaveURL(url);
    }
  });
});

test.describe('net worth', () => {
  test('shows assets, the trend and liabilities', async ({ page }) => {
    await page.goto('/networth');
    await expect(page.getByText('Net worth trend')).toBeVisible();
    await expect(page.getByText('Assets', { exact: true }).first()).toBeVisible();
    await page.getByRole('link', { name: 'Liabilities' }).click();
    await expect(page).toHaveURL(/tab=liabilities/);
    await expect(page.getByText('Student Loan').first()).toBeVisible();
  });
});

test.describe('budgets', () => {
  test('shows the total budget and flags categories over budget', async ({ page }) => {
    await page.goto('/budgets');
    await expect(page.getByText('Total budget').first()).toBeVisible();
    await expect(page.getByText('Shopping').first()).toBeVisible();
    await expect(page.getByText(/over/i).first()).toBeVisible();
  });
});

test.describe('reports', () => {
  test('shows cashflow, category breakdown and top merchants', async ({ page }) => {
    await page.goto('/reports');
    for (const t of ['Cashflow', 'Category breakdown', 'Top merchants']) await expect(page.getByText(t).first()).toBeVisible();
    await expect(page.getByText('Central Ladprao').first()).toBeVisible();
  });
});
