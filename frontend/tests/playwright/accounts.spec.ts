import { api, expect, test } from './fixtures';

test.describe('accounts', () => {
  test('lists the seeded accounts with a total', async ({ page }) => {
    await page.goto('/accounts');
    for (const name of ['Kasikorn Savings', 'SCB Current', 'Cash Wallet', 'TrueMoney', 'KTC Credit']) {
      await expect(page.getByText(name).first()).toBeVisible();
    }
  });

  test('adds, edits and deletes an account', async ({ page, request }) => {
    await page.goto('/accounts');
    await page.getByRole('button', { name: 'Add account' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Account name').fill('Piggy Bank');
    await dialog.getByLabel('Balance (฿)').fill('1500');
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Piggy Bank')).toBeVisible();
    expect((await api(request, '/accounts')).data.some((a: { name: string; balance: number }) => a.name === 'Piggy Bank' && a.balance === 1500)).toBe(true);

    // A new row has sort 0, so it lists first.
    await page.getByRole('button', { name: 'Edit account' }).first().click();
    await page.getByRole('dialog').getByLabel('Balance (฿)').fill('2500');
    await page.getByRole('dialog').getByRole('button', { name: 'Save changes' }).click();
    await expect.poll(async () => (await api(request, '/accounts')).data.find((a: { name: string }) => a.name === 'Piggy Bank')?.balance).toBe(2500);

    await page.getByRole('button', { name: 'Edit account' }).first().click();
    const del = page.getByRole('dialog').getByRole('button', { name: 'Delete' });
    await del.click();
    await page.getByRole('dialog').getByRole('button', { name: 'Click again to delete this account' }).click();
    await expect(page.getByText('Piggy Bank')).toHaveCount(0);
  });

  test('rejects a duplicate name and refuses to delete an account in use', async ({ page }) => {
    await page.goto('/accounts');
    await page.getByRole('button', { name: 'Add account' }).click();
    await page.getByRole('dialog').getByLabel('Account name').fill('scb current');
    await page.getByRole('dialog').getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('An account with this name already exists.')).toBeVisible();
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Edit account' }).first().click(); // Kasikorn Savings has transactions
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Click again to delete this account' }).click();
    await expect(page.getByText('This account has transactions, so it cannot be deleted.')).toBeVisible();
  });
});
