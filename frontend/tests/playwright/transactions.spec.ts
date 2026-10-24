import type { Page } from '@playwright/test';
import { api, expect, test } from './fixtures';

type Tx = { name: string; acct: string; amount: number; activity: string; item: string; cat: string; goal: string; interest: number; fee: number };

// The seeded month has 12 rows, so row 12 (0-based) is the first blank one.
const BLANK = 12;
const cell = (page: Page, row: number, field: string) => page.locator(`[data-r="${row}"][data-f="${field}"]`);

async function pick(page: Page, row: number, field: string, option: string) {
  await cell(page, row, field).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

/** Leaves the row so the sheet saves it. */
const leaveRow = (page: Page) => page.getByRole('heading', { name: 'Transactions' }).click();

const june = async (request: Parameters<typeof api>[0]) =>
  (await api<{ data: Tx[] }>(request, '/transactions?from=2026-06-01&to=2026-06-30&limit=500')).data;

test.describe('transactions sheet', () => {
  test('shows the seeded month with its summary', async ({ page }) => {
    await page.goto('/transactions');
    await expect(page.locator('table tbody tr').first()).toBeVisible();
    await expect(page.getByText('Monthly salary').first()).toBeVisible();
    await expect(page.getByText('฿62,000').first()).toBeVisible();
    await expect(page.getByText('Item (by activity)')).toBeVisible();
  });

  test('records a payment from the sheet', async ({ page, request }) => {
    await page.goto('/transactions');
    await pick(page, BLANK, 'cat', 'Food & Dining');
    await pick(page, BLANK, 'acct', 'SCB Current');
    await cell(page, BLANK, 'amount').fill('120.50');
    await cell(page, BLANK, 'note').fill('Pad thai');
    await leaveRow(page);
    await expect.poll(async () => (await june(request)).find((t) => t.name === 'Pad thai' || t.amount === -120.5)).toMatchObject({
      activity: 'pay', cat: 'food', acct: 'SCB Current', amount: -120.5,
    });
  });

  test('records a transfer into one account out of another', async ({ page, request }) => {
    await page.goto('/transactions');
    await pick(page, BLANK, 'activity', 'Transfer');
    await expect(cell(page, BLANK, 'cat')).toHaveCount(0); // no category for a transfer
    await pick(page, BLANK, 'acct', 'SCB Current');
    await pick(page, BLANK, 'item', 'Cash Wallet');
    await cell(page, BLANK, 'amount').fill('500');
    await leaveRow(page);
    await expect.poll(async () => (await june(request)).find((t) => t.activity === 'transfer')).toMatchObject({
      acct: 'SCB Current', item: 'Cash Wallet', amount: 500, cat: '',
    });
  });

  test('records savings with a goal, and a debt payment with interest and fee', async ({ page, request }) => {
    await page.goto('/transactions');
    await pick(page, BLANK, 'activity', 'Save');
    await pick(page, BLANK, 'item', 'Gold savings');
    await pick(page, BLANK, 'acct', 'SCB Current');
    await pick(page, BLANK, 'goal', 'Japan Trip');
    await cell(page, BLANK, 'amount').fill('1000');
    await leaveRow(page);
    await expect.poll(async () => (await june(request)).find((t) => t.activity === 'save')).toMatchObject({
      item: 'Gold savings', goal: 'Japan Trip', cat: 'saving', amount: -1000,
    });

    await pick(page, BLANK + 1, 'activity', 'Pay debt');
    await pick(page, BLANK + 1, 'item', 'Kbank Nano 3');
    await pick(page, BLANK + 1, 'acct', 'SCB Current');
    await cell(page, BLANK + 1, 'amount').fill('1358');
    await cell(page, BLANK + 1, 'interest').fill('120.75');
    await cell(page, BLANK + 1, 'fee').fill('15');
    await leaveRow(page);
    await expect.poll(async () => (await june(request)).find((t) => t.activity === 'pay_debt')).toMatchObject({
      item: 'Kbank Nano 3', interest: 120.75, fee: 15, amount: -1358,
    });
  });

  test('keeps an incomplete row unsaved and flags it', async ({ page, request }) => {
    await page.goto('/transactions');
    const before = (await june(request)).length;
    await cell(page, BLANK, 'amount').fill('99');
    await leaveRow(page);
    await expect(page.getByTitle('Row incomplete — not saved yet')).toBeVisible();
    expect((await june(request)).length).toBe(before);
  });

  test('only offers items that fit the activity', async ({ page }) => {
    await page.goto('/transactions');
    await pick(page, BLANK, 'acct', 'SCB Current');
    await pick(page, BLANK, 'activity', 'Transfer');
    await cell(page, BLANK, 'item').click();
    await expect(page.getByRole('option', { name: 'SCB Current', exact: true })).toHaveCount(0); // not to itself
    await expect(page.getByRole('option', { name: 'Cash Wallet', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await pick(page, BLANK + 1, 'activity', 'Receive');
    await cell(page, BLANK + 1, 'item').click();
    await expect(page.getByRole('option', { name: 'Freelance work' })).toBeVisible();
  });

  test('edits an existing row in place and saves the change', async ({ page, request }) => {
    await page.goto('/transactions');
    // Row 10 (0-based) is Starbucks, -185 on SCB Current.
    await expect(cell(page, 10, 'amount')).toHaveValue('185');
    await cell(page, 10, 'amount').fill('210.25');
    await cell(page, 10, 'note').fill('Latte x2');
    await pick(page, 10, 'acct', 'Cash Wallet');
    await leaveRow(page);
    await expect.poll(async () => (await june(request)).find((t) => t.name === 'Starbucks')).toMatchObject({ amount: -210.25, acct: 'Cash Wallet' });
    await page.reload();
    await expect(cell(page, 10, 'amount')).toHaveValue('210.25');
  });

  test('Escape puts a cell back to its saved value', async ({ page }) => {
    await page.goto('/transactions');
    await cell(page, 10, 'amount').fill('999');
    await cell(page, 10, 'amount').press('Escape');
    await expect(cell(page, 10, 'amount')).toHaveValue('185');
  });

  test('deletes a single row and a selection of rows', async ({ page, request }) => {
    await page.goto('/transactions');
    page.on('dialog', (d) => d.accept());
    const before = (await june(request)).length;
    await page.getByRole('checkbox', { name: 'Select row' }).nth(0).check();
    await page.getByRole('checkbox', { name: 'Select row' }).nth(1).check();
    await page.getByRole('button', { name: 'Delete selected' }).click();
    await expect.poll(async () => (await june(request)).length).toBe(before - 2);

    await page.locator('tbody tr').first().hover();
    await page.getByRole('button', { name: 'Delete row' }).first().click();
    await expect.poll(async () => (await june(request)).length).toBe(before - 3);
  });

  test('pastes several tab-separated rows at once', async ({ page, request }) => {
    await page.goto('/transactions');
    const text = [
      '2026-06-20\tจ่ายเงิน\tfood\tCash Wallet\t75\t\t\t\tNoodles',
      '2026-06-21\tสะสมเงิน\tGold savings\tSCB Current\t2000\t\t\tJapan Trip\t',
    ].join('\n');
    await cell(page, BLANK, 'note').evaluate((el, data) => {
      const dt = new DataTransfer();
      dt.setData('text', data);
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    }, text);
    await expect(page.getByText('Added 2 rows')).toBeVisible();
    const rows = await june(request);
    expect(rows.find((t) => t.name === 'Noodles')).toMatchObject({ activity: 'pay', acct: 'Cash Wallet', amount: -75 });
    expect(rows.find((t) => t.activity === 'save' && t.item === 'Gold savings')).toMatchObject({ goal: 'Japan Trip', amount: -2000 });
  });

  test('rejects a bad paste and says which line', async ({ page, request }) => {
    await page.goto('/transactions');
    const before = (await june(request)).length;
    await cell(page, BLANK, 'note').evaluate((el) => {
      const dt = new DataTransfer();
      dt.setData('text', '2026-06-20\tจ่ายเงิน\tfood\tCash Wallet\t75\n2026-06-21\tจ่ายเงิน\tfood\tCash Wallet\tabc');
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    });
    await expect(page.getByText(/Line 2: invalid amount/)).toBeVisible();
    expect((await june(request)).length).toBe(before);
  });

  test('moves between months', async ({ page }) => {
    await page.goto('/transactions');
    await page.getByRole('link', { name: 'Next month' }).click();
    await expect(page).toHaveURL(/month=2026-07/);
    await expect(page.getByText('Monthly salary')).toHaveCount(0);
    await page.getByRole('link', { name: 'Previous month' }).click();
    await expect(page).toHaveURL(/month=2026-06/);
    await expect(page.getByText('Monthly salary').first()).toBeVisible();
  });

  test('opens a transaction detail page', async ({ page }) => {
    await page.goto('/transactions/1');
    await expect(page.getByText('Acme Co. payroll')).toBeVisible();
  });
});

test.describe('transactions on a phone', () => {
  test.use({ viewport: { width: 390, height: 800 } });

  test('lists rows grouped by day and filters income / expenses', async ({ page }) => {
    await page.goto('/transactions');
    // The desktop sheet is hidden on a phone, so only the card list is in the accessibility tree.
    await expect(page.getByRole('link', { name: /Starbucks/ })).toBeVisible();
    await page.getByRole('link', { name: 'Income', exact: true }).click();
    await expect(page).toHaveURL(/type=income/);
    await expect(page.getByRole('link', { name: /Monthly Salary/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Starbucks/ })).toHaveCount(0);
  });
});

test.describe('transactions in Thai', () => {
  test.use({ lang: 'th' });

  test('shows the six Thai activities', async ({ page }) => {
    await page.goto('/transactions');
    await cell(page, BLANK, 'activity').click();
    for (const a of ['รับเงิน', 'จ่ายเงิน', 'สะสมเงิน', 'ชำระหนี้', 'เบิกเงิน', 'เปลี่ยนบัญชี']) {
      await expect(page.getByRole('option', { name: a, exact: true })).toBeVisible();
    }
  });
});
