import { expect, test } from './fixtures';

test.describe('public landing demo', () => {
  test.use({ signedIn: false, reseedFirst: false });

  test('edits, adds and resets sample rows using browser storage without calling the API', async ({ page }) => {
    const financeApiCalls: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/v1/')) financeApiCalls.push(request.url());
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'A clearer view of your money.' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Your month, at a glance' })).toBeVisible();
    await page.locator('#demo-name-salary').fill('My sample paycheck');
    await page.getByLabel('What was it for?').fill('Weekend project');
    await page.getByLabel('Transaction type').selectOption('income');
    await page.getByLabel('Amount in baht').fill('3500');
    await page.getByRole('button', { name: 'Add row' }).click();
    await expect(page.getByLabel('Transaction name: Weekend project')).toBeVisible();
    await expect(page.getByLabel('Transaction name: My sample paycheck')).toBeVisible();

    await page.reload();
    await expect(page.getByLabel('Transaction name: Weekend project')).toBeVisible();
    await expect(page.getByLabel('Transaction name: My sample paycheck')).toBeVisible();
    await page.getByRole('button', { name: 'Reset sample' }).click();
    await expect(page.getByLabel('Transaction name: Monthly salary')).toBeVisible();
    await expect(page.getByLabel('Transaction name: Weekend project')).toHaveCount(0);
    expect(financeApiCalls).toEqual([]);
  });
});
