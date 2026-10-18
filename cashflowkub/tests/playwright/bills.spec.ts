import type { Page } from '@playwright/test';
import { api, expect, test } from './fixtures';

type BillRow = { name: string; paid: boolean; amount: number; dueDay?: number; kind: string; freq: string };

/** The tick box that belongs to the bill with this name (nearest ancestor holding a checkbox). */
const tickOf = (page: Page, name: string) =>
  page.getByText(name, { exact: true }).first().locator('xpath=ancestor::*[.//*[@role="checkbox"]][1]').getByRole('checkbox');

const bills = async (request: Parameters<typeof api>[0], month = '2026-06') => (await api<{ data: BillRow[] }>(request, `/bills?month=${month}`)).data;

test.describe('bills', () => {
  test('lists the month with paid and remaining totals', async ({ page }) => {
    await page.goto('/bills');
    await expect(page.getByText('Bills this month')).toBeVisible();
    for (const n of ['Apartment Rent', 'PEA Electricity', 'MEA Water', 'Netflix Premium']) await expect(page.getByText(n, { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Remaining').first()).toBeVisible();
  });

  test('marks a bill paid and unpaid', async ({ page, request }) => {
    await page.goto('/bills');
    await tickOf(page, 'MEA Water').click();
    await expect.poll(async () => (await bills(request)).find((b) => b.name === 'MEA Water')?.paid).toBe(true);
    await expect(tickOf(page, 'MEA Water')).toHaveAttribute('aria-checked', 'true');
    await tickOf(page, 'MEA Water').click();
    await expect.poll(async () => (await bills(request)).find((b) => b.name === 'MEA Water')?.paid).toBe(false);
  });

  test('filters subscriptions from bills', async ({ page }) => {
    await page.goto('/bills');
    await page.getByRole('link', { name: 'Subscription', exact: true }).click();
    await expect(page).toHaveURL(/kind=subscription/);
    await expect(page.getByText('Netflix Premium').first()).toBeVisible();
    await expect(page.getByText('Apartment Rent')).toHaveCount(0);
  });

  test('switches to the calendar and back', async ({ page }) => {
    await page.goto('/bills');
    await page.getByRole('link', { name: 'Calendar', exact: true }).click();
    await expect(page).toHaveURL(/view=calendar/);
    await page.getByRole('link', { name: 'List', exact: true }).click();
    await expect(page).toHaveURL(/view=list|\/bills(\?|$)/);
  });

  test('moves to next month where nothing is paid yet', async ({ page, request }) => {
    await page.goto('/bills');
    await page.getByRole('link', { name: 'Next month' }).click();
    await expect(page).toHaveURL(/month=2026-07/);
    await expect(page.getByText('Apartment Rent', { exact: true }).first()).toBeVisible();
    expect((await bills(request, '2026-07')).every((b) => !b.paid)).toBe(true);
  });

  test('adds a recurring bill, then edits and deletes it', async ({ page, request }) => {
    await page.goto('/bills');
    await page.getByRole('button', { name: 'Add bill' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Name').fill('Gym');
    await dialog.getByLabel('Amount (฿)').fill('1200');
    await dialog.getByLabel('Due day of month').fill('12');
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect.poll(async () => (await bills(request)).find((b) => b.name === 'Gym')).toMatchObject({ amount: 1200, kind: 'bill', freq: 'monthly' });

    await page.getByText('Gym', { exact: true }).first().locator('xpath=ancestor::*[.//button[@aria-label="Edit bill"]][1]').getByRole('button', { name: 'Edit bill' }).click();
    await page.getByRole('dialog').getByLabel('Amount (฿)').fill('1500');
    await page.getByRole('dialog').getByRole('button', { name: 'Save changes' }).click();
    await expect.poll(async () => (await bills(request)).find((b) => b.name === 'Gym')?.amount).toBe(1500);

    await page.getByText('Gym', { exact: true }).first().locator('xpath=ancestor::*[.//button[@aria-label="Edit bill"]][1]').getByRole('button', { name: 'Edit bill' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Click again to delete this bill' }).click();
    await expect.poll(async () => (await bills(request)).some((b) => b.name === 'Gym')).toBe(false);
  });

  test('adds a subscription', async ({ page, request }) => {
    await page.goto('/bills');
    await page.getByRole('button', { name: 'Add bill' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Subscription', exact: true }).click();
    await expect(dialog.getByRole('heading', { name: 'Add subscription' })).toBeVisible();
    await dialog.getByLabel('Name').fill('YouTube Premium');
    await dialog.getByLabel('Amount (฿)').fill('179');
    await dialog.getByLabel('Due day of month').fill('8');
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect.poll(async () => (await bills(request)).find((b) => b.name === 'YouTube Premium')).toMatchObject({ kind: 'subscription', amount: 179 });
  });
});
