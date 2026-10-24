import { api, expect, test } from './fixtures';

test.describe('goals', () => {
  test('lists the seeded goals', async ({ page }) => {
    await page.goto('/goals');
    for (const name of ['Emergency Fund', 'Japan Trip', 'New iPhone']) await expect(page.getByText(name).first()).toBeVisible();
  });

  test('adds, edits and deletes a goal', async ({ page, request }) => {
    await page.goto('/goals');
    await page.getByRole('button', { name: 'New goal' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Name').fill('New Car');
    await dialog.getByLabel('Target (฿)').fill('300000');
    await dialog.getByLabel('Saved (฿)').fill('10000');
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('New Car')).toBeVisible();
    expect((await api(request, '/goals')).data.find((g: { name: string }) => g.name === 'New Car')).toMatchObject({ target: 300000, saved: 10000 });

    // A new row has sort 0, so it lists first.
    await page.getByRole('button', { name: 'Edit goal' }).first().click();
    await page.getByRole('dialog').getByLabel('Saved (฿)').fill('20000');
    await page.getByRole('dialog').getByRole('button', { name: 'Save changes' }).click();
    await expect.poll(async () => (await api(request, '/goals')).data.find((g: { name: string }) => g.name === 'New Car')?.saved).toBe(20000);

    await page.getByRole('button', { name: 'Edit goal' }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Click again to delete this goal' }).click();
    await expect(page.getByText('New Car')).toHaveCount(0);
  });

  test('rejects a duplicate goal name', async ({ page }) => {
    await page.goto('/goals');
    await page.getByRole('button', { name: 'New goal' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Name').fill('japan trip');
    await dialog.getByLabel('Target (฿)').fill('1000');
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('A goal with this name already exists.')).toBeVisible();
  });
});
