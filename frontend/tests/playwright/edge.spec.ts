import { api, expect, test } from './fixtures';

type BillRow = { name: string; freq: string; amount: number; paid: boolean };
const bills = async (request: Parameters<typeof api>[0]) => (await api<{ data: BillRow[] }>(request, '/bills?month=2026-06')).data;

test.describe('bills: one-time bills and the calendar', () => {
  test('adds a one-time bill on an exact date', async ({ page, request }) => {
    await page.goto('/bills');
    await page.getByRole('button', { name: 'Add bill' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Name').fill('Visa fee');
    await dialog.getByLabel('Amount (฿)').fill('500');
    await dialog.getByLabel('Repeats').click();
    await page.getByRole('option', { name: 'One time' }).click();
    await dialog.getByLabel('Due date').fill('2026-06-28');
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect.poll(async () => (await bills(request)).find((b) => b.name === 'Visa fee')).toMatchObject({ freq: 'once', amount: 500 });
  });

  test('opens a calendar day and ticks a bill paid from there', async ({ page, request }) => {
    await page.goto('/bills?view=calendar');
    await page.getByRole('button', { name: /^20/ }).click(); // MEA Water and AIS Mobile are due on the 20th
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('MEA Water')).toBeVisible();
    await dialog.getByRole('checkbox').first().click();
    await expect.poll(async () => (await bills(request)).filter((b) => ['MEA Water', 'AIS Mobile'].includes(b.name)).some((b) => b.paid)).toBe(true);
  });
});

test.describe('debts: closed debts and missing pages', () => {
  test('shows a paid-off debt as closed', async ({ page }) => {
    const res = await page.request.get('/api/v1/debts?status=paid');
    const closed = (await res.json()).data[0];
    await page.goto(`/debts/${closed.id}?tab=schedule`);
    await expect(page.getByText('This debt is paid off')).toBeVisible();
  });

  test('answers an unknown debt or transaction with a not-found page', async ({ page }) => {
    expect((await page.goto('/debts/9999'))?.status()).toBe(404);
    expect((await page.goto('/transactions/9999'))?.status()).toBe(404);
  });
});

test.describe('transaction detail', () => {
  test('deletes a transaction from its detail page', async ({ page, request }) => {
    page.on('dialog', (d) => d.accept());
    await page.goto('/transactions/2');
    await page.getByRole('button', { name: /Delete/ }).first().click();
    await expect.poll(async () => (await request.get('/api/v1/transactions/2')).status()).toBe(404);
  });
});

test.describe('phone navigation', () => {
  test.use({ viewport: { width: 390, height: 800 } });

  test('opens the menu and navigates', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('link', { name: 'Bills', exact: true }).click();
    await expect(page).toHaveURL(/\/bills/);
  });
});

test.describe('plan month picker', () => {
  test('jumps to another month on the plan page', async ({ page }) => {
    await page.goto('/plan?tab=monthly');
    await page.locator('input[type="month"]').fill('2026-07');
    await expect(page).toHaveURL(/month=2026-07/);
    await expect(page.getByText('Nothing planned here yet.').first()).toBeVisible();
  });
});

test.describe('debt schedule', () => {
  test('edits a month of the amortization schedule and recalculates later months', async ({ page }) => {
    await page.goto('/debts/2?tab=schedule');
    const table = page.locator('table').first();
    const before = await table.innerText();
    await table.locator('tbody tr').first().locator('td').nth(1).click();
    const input = table.locator('input').first();
    await input.fill('9000');
    await input.press('Enter');
    await expect.poll(async () => table.innerText()).not.toBe(before);
  });
});

test.describe('debt what-if', () => {
  test('applies a new rate to the debt and can reset the experiment', async ({ page, request }) => {
    await page.goto('/debts/2?tab=schedule');
    await page.getByLabel('APR (%)').fill('18');
    await page.getByRole('button', { name: 'Reset' }).click();
    await expect(page.getByLabel('APR (%)')).toHaveValue('');
    await page.getByLabel('APR (%)').fill('18');
    await page.getByRole('button', { name: 'Apply to debt' }).click();
    await expect.poll(async () => (await api<{ apr: number }>(request, '/debts/2')).apr).toBe(18);
  });

  test('says how much a month a target payoff time needs', async ({ page }) => {
    await page.goto('/debts/2?tab=schedule');
    await page.getByLabel('Pay off in (months)').fill('12');
    await expect(page.getByText(/Needs ฿[\d,]+\/mo/)).toBeVisible();
  });
});
