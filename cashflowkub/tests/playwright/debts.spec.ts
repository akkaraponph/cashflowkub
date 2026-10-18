import { api, expect, test } from './fixtures';

type Debt = { id: number; name: string; remaining: number; paid: number };
const debt = async (request: Parameters<typeof api>[0], id: number) => api<Debt>(request, `/debts/${id}`);

test.describe('debts', () => {
  test('lists active debts with the remaining total', async ({ page }) => {
    await page.goto('/debts');
    await expect(page.getByText('Total debt remaining')).toBeVisible();
    await expect(page.getByText('KrungThai Personal').first()).toBeVisible();
    await expect(page.getByText('฿257,147')).toBeVisible();
    await expect(page.getByText('Active debts', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Kbank Nano 2/ })).toBeVisible();
  });

  test('switches strategy between avalanche, snowball and custom', async ({ page }) => {
    await page.goto('/debts');
    await page.getByRole('link', { name: 'Snowball' }).click();
    await expect(page).toHaveURL(/strategy=snowball/);
    await expect(page.getByText('Pay smallest balance first — quickest wins.')).toBeVisible();
    await page.getByRole('link', { name: 'Avalanche' }).click();
    await expect(page.getByText('Pay highest interest first — saves the most money.')).toBeVisible();
    await page.getByRole('link', { name: 'Custom' }).click();
    await expect(page.getByText('Pay in the order you choose.')).toBeVisible();
  });

  test('adds a debt, edits it, and it appears in the list', async ({ page, request }) => {
    await page.goto('/debts');
    await page.getByRole('button', { name: 'Add debt' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Name', { exact: true }).fill('Laptop Loan');
    await dialog.getByLabel('Original debt (฿)').fill('30000');
    await dialog.getByLabel('Minimum payment (฿)').fill('1500');
    await dialog.getByLabel('Term (months)').fill('24');
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Laptop Loan').first()).toBeVisible();
    const list = (await api<{ data: (Debt & { original: number })[] }>(request, '/debts')).data;
    const created = list.find((d) => d.name === 'Laptop Loan');
    expect(created).toMatchObject({ original: 30000, remaining: 30000 });

    await page.goto(`/debts/${created!.id}`);
    await page.getByRole('button', { name: 'Edit debt' }).click();
    await page.getByRole('dialog').getByLabel('Original debt (฿)').fill('28000');
    await page.getByRole('dialog').getByRole('button', { name: 'Save changes' }).click();
    await expect.poll(async () => (await debt(request, created!.id)).remaining).toBe(28000);
  });

  test('refuses a duplicate debt name', async ({ page }) => {
    await page.goto('/debts');
    await page.getByRole('button', { name: 'Add debt' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Name', { exact: true }).fill('kbank nano 3');
    await dialog.getByLabel('Original debt (฿)').fill('1000');
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('A debt with this name already exists.')).toBeVisible();
  });
});

test.describe('debt detail', () => {
  test('shows the balance, terms and payment history', async ({ page }) => {
    await page.goto('/debts/2');
    await expect(page.getByText('KrungThai Personal').first()).toBeVisible();
    await expect(page.getByText('Reducing balance').first()).toBeVisible();
    await expect(page.getByText('Payment history')).toBeVisible();
    await expect(page.getByText('45,700').first()).toBeVisible();
  });

  test('records a payment that lowers the balance, then deletes it', async ({ page, request }) => {
    const before = (await debt(request, 2)).remaining;
    await page.goto('/debts/2');
    await page.getByRole('button', { name: 'Record payment' }).click();
    await page.getByRole('dialog').getByLabel('Amount (฿)').fill('5000');
    await page.getByRole('dialog').getByRole('button', { name: 'Save changes' }).click();
    await expect.poll(async () => (await debt(request, 2)).remaining).toBeLessThan(before);

    page.on('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Delete' }).first().click();
    await expect.poll(async () => (await debt(request, 2)).remaining).toBe(before);
  });

  test('shows the amortization schedule', async ({ page }) => {
    await page.goto('/debts/2');
    await page.getByRole('link', { name: 'Schedule' }).click();
    await expect(page).toHaveURL(/tab=schedule/);
    await expect(page.getByText('Total interest').first()).toBeVisible();
    await expect(page.getByText(/Click a payment to change that month/)).toBeVisible();
  });

  test('shows the history of a debt on a fixed instalment', async ({ page }) => {
    await page.goto('/debts/16');
    await expect(page.getByText('Payment history')).toBeVisible();
  });
});

test.describe('smart plan', () => {
  test('shows the debt service ratio once income is set', async ({ page }) => {
    await page.goto('/debts/plan');
    await expect(page.getByText('Debt service ratio (DSR)')).toBeVisible();
    await expect(page.getByText('Recommended actions')).toBeVisible();
  });

  test('edits monthly income', async ({ page, request }) => {
    await page.goto('/debts/plan');
    await page.getByRole('button', { name: 'Edit income' }).click();
    await page.getByRole('dialog').getByLabel('Monthly income (฿)').fill('80000');
    await page.getByRole('dialog').getByRole('button', { name: 'Save changes' }).click();
    await expect.poll(async () => JSON.stringify(await api(request, '/debts/dsr'))).toContain('80000');
  });

  test('simulates extra payments and compares with minimums only', async ({ page }) => {
    await page.goto('/debts/plan');
    await page.getByLabel('Extra per month (฿)').fill('2000');
    await page.getByRole('button', { name: 'Simulate' }).click();
    await expect(page).toHaveURL(/extra=2000/);
    await expect(page.getByText('Interest saved')).toBeVisible();
    await expect(page.getByText('Minimums only')).toBeVisible();
    await expect(page.getByText('Payoff order')).toBeVisible();
  });
});
