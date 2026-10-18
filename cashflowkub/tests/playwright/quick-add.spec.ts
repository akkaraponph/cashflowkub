import { api, expect, test } from './fixtures';

type Tx = { name: string; cat: string; acct: string; amount: number; activity: string; note: string };
const all = async (request: Parameters<typeof api>[0]) => (await api<{ data: Tx[] }>(request, '/transactions?limit=500')).data;

test.describe('quick add transaction', () => {
  test('adds an expense from the transactions page', async ({ page, request }) => {
    await page.goto('/transactions');
    await page.getByRole('button', { name: 'Add transaction' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('button', { name: 'Save changes' })).toBeDisabled(); // no amount yet
    await dialog.getByLabel('Amount (฿)').fill('250');
    await dialog.getByRole('button', { name: 'Transit', exact: true }).click();
    await dialog.getByLabel('Note').fill('Taxi home');
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect.poll(async () => (await all(request)).find((t) => t.note === 'Taxi home')).toMatchObject({ cat: 'transport', amount: -250, activity: 'pay' });
  });

  test('adds income as a receive', async ({ page, request }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Add transaction' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Income', exact: true }).click();
    await dialog.getByLabel('Amount (฿)').fill('1000');
    await dialog.getByLabel('Note').fill('Gift');
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect.poll(async () => (await all(request)).find((t) => t.note === 'Gift')).toMatchObject({ cat: 'income', amount: 1000, activity: 'receive' });
  });
});
