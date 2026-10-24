import { execFileSync } from 'node:child_process';
import { expect, test } from './fixtures';

const sql = (statement: string) => execFileSync('psql', [process.env.TEST_DATABASE_URL!, '-c', statement], { stdio: 'pipe' });

const PASSWORD = 'a-long-test-password';

test.describe('signed out', () => {
  test.use({ signedIn: false });

  test('the landing page is public and the dashboard goes to /login', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'A clearer view of your money.' })).toBeVisible();
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  });

  test('a visit to an inner page goes to /login, and the API says 401', async ({ page, request }) => {
    await page.goto('/transactions');
    await expect(page).toHaveURL(/\/login$/);
    expect((await request.get('/api/v1/accounts')).status()).toBe(401);
  });

  test('sign up lands on an empty dashboard with the new name in the header', async ({ page }) => {
    await page.goto('/signup');
    const submit = page.getByRole('button', { name: 'Create account' });
    await page.getByLabel('Name').fill('Mali');
    await page.getByLabel('Email').fill('mali@example.test');
    await page.getByLabel('Password').fill(PASSWORD);
    await expect(submit).toBeDisabled();
    await page.getByRole('checkbox').check();
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { name: 'Good morning, Mali' })).toBeVisible();
    await expect(page.getByText('Monthly Salary')).toHaveCount(0);
    await page.goto('/settings');
    await expect(page.getByText('mali@example.test')).toBeVisible();
  });

  test('a password shorter than 10 characters is rejected', async ({ page }) => {
    await page.goto('/signup');
    await page.getByLabel('Name').fill('Mali');
    await page.getByLabel('Email').fill('short@example.test');
    await page.getByLabel('Password').fill('short');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.locator('form [role=alert]')).toContainText('at least 10 characters');
    await expect(page).toHaveURL(/\/signup$/);
  });

  test('wrong password shows the English error and stays on /login', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('demo@cashflowkub.local');
    await page.getByLabel('Password').fill('not-the-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.locator('form [role=alert]')).toHaveText('Wrong email or password.');
    await expect(page).toHaveURL(/\/login$/);
  });

  test.describe('in Thai', () => {
    test.use({ lang: 'th' });
    test('wrong password shows the Thai error and stays on /login', async ({ page }) => {
      await page.goto('/login');
      await page.getByLabel('อีเมล').fill('demo@cashflowkub.local');
      await page.getByLabel('รหัสผ่าน').fill('not-the-password');
      await page.getByRole('button', { name: 'เข้าสู่ระบบ' }).click();
      await expect(page.locator('form [role=alert]')).toHaveText('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
      await expect(page).toHaveURL(/\/login$/);
    });

    test('/privacy renders in Thai with the controller contact', async ({ page }) => {
      await page.goto('/privacy');
      await expect(page.getByRole('heading', { level: 1 })).toContainText('นโยบายความเป็นส่วนตัว');
      await expect(page.getByText(process.env.PRIVACY_CONTACT_EMAIL!).first()).toBeVisible();
      await expect(page.getByText(process.env.PRIVACY_CONTROLLER_NAME!).first()).toBeVisible();
      await expect(page.locator('body')).toContainText('PDPC');
    });
  });

  test('/privacy renders in English with the version', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Privacy notice');
    await expect(page.locator('body')).toContainText('2026-10-19');
  });
});

test('the header and settings show the signed-in user, not a placeholder', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Good morning, Ploy' })).toBeVisible();
  await page.goto('/settings');
  await expect(page.getByText('demo@cashflowkub.local')).toBeVisible();
});

test('sign out from settings returns to /login, and back-navigation does not show data', async ({ page }) => {
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText('Net worth')).toHaveCount(0);
});

test('a user with an old privacy version is redirected, accepts, and lands on the dashboard', async ({ page }) => {
  sql("UPDATE users SET privacy_version = '2020-01-01'");
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/privacy-update$/);
  await expect(page.getByRole('heading', { name: 'The privacy notice changed' })).toBeVisible();
  await page.getByRole('button', { name: 'I have read it, continue' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Good morning, Ploy' })).toBeVisible();
});

test('an account with no categories gets the defaults back on the next visit', async ({ page }) => {
  sql('DELETE FROM categories');
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Good morning, Ploy' })).toBeVisible();
  const res = await page.request.get('/api/v1/categories');
  expect((await res.json()).data.length).toBeGreaterThan(0);
});
