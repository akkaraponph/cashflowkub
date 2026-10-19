import { DEMO_EMAIL, expect, test } from './fixtures';

const open = async (page: import('@playwright/test').Page, trigger: string, dialogTitle: string) => {
  await page.goto('/settings');
  await page.getByRole('button', { name: trigger }).click();
  const dialog = page.getByRole('dialog', { name: dialogTitle });
  await expect(dialog).toBeVisible();
  return dialog;
};

test('delete account requires typing DELETE and the password, then lands on /login with a toast', async ({ page, request }) => {
  const dialog = await open(page, 'Delete account', 'Delete account');
  await expect(dialog).toContainText('cannot be undone');
  await expect(dialog.getByRole('link', { name: 'Download my data' })).toHaveAttribute('href', '/api/v1/me/export');
  const confirm = dialog.getByRole('button', { name: 'Delete my account' });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel('Password').fill(process.env.SEED_DEMO_PASSWORD!);
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel(/Type DELETE/).fill('delete');
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel(/Type DELETE/).fill('DELETE');
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText('Your account and data were deleted.')).toBeVisible();
  expect((await request.get('/api/v1/accounts')).status()).toBe(401);

  await page.getByLabel('Email').fill(DEMO_EMAIL);
  await page.getByLabel('Password').fill(process.env.SEED_DEMO_PASSWORD!);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('form [role=alert]')).toHaveText('Wrong email or password.');
  await expect(page).toHaveURL(/\/login$/);
});

test('a wrong password shows the translated error and deletes nothing', async ({ page, request }) => {
  const dialog = await open(page, 'Delete account', 'Delete account');
  await dialog.getByLabel('Password').fill('not-the-password');
  await dialog.getByLabel(/Type DELETE/).fill('DELETE');
  await dialog.getByRole('button', { name: 'Delete my account' }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Wrong password.');
  await expect(page).toHaveURL(/\/settings$/);
  expect((await request.get('/api/v1/accounts')).status()).toBe(200);
});

test.describe('in Thai', () => {
  test.use({ lang: 'th' });
  test('the word to type is ลบบัญชี', async ({ page }) => {
    const dialog = await open(page, 'ลบบัญชี', 'ลบบัญชี');
    const confirm = dialog.getByRole('button', { name: 'ลบบัญชีของฉัน' });
    await dialog.getByLabel('รหัสผ่าน').fill(process.env.SEED_DEMO_PASSWORD!);
    await dialog.getByLabel(/พิมพ์ ลบบัญชี/).fill('DELETE');
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel(/พิมพ์ ลบบัญชี/).fill('ลบบัญชี');
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText('ลบบัญชีและข้อมูลของคุณแล้ว')).toBeVisible();
  });
});
