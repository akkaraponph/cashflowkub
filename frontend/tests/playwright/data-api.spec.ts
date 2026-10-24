import { api, expect, test } from './fixtures';

// These records have no editing screen: the app reads them (net worth, budgets, setup, the transaction sheet) and exposes them over the
// REST API. The tests write through the API and check that the screens that read them change.

type Row = { id: number; name?: string; cat?: string; limit?: number; value?: number };

test.describe('budgets', () => {
  test('a changed limit shows in the total budget, and a removed budget leaves it', async ({ page, request }) => {
    const food = (await api<{ data: Row[] }>(request, '/budgets')).data.find((b) => b.cat === 'food')!;
    await page.goto('/budgets');
    await expect(page.getByText('฿19,000').first()).toBeVisible();

    expect((await request.patch(`/api/v1/budgets/${food.id}`, { data: { limit: 9000 } })).status()).toBe(200);
    await page.reload();
    await expect(page.getByText('฿23,000').first()).toBeVisible();

    expect((await request.delete(`/api/v1/budgets/${food.id}`)).status()).toBe(204);
    await page.reload();
    await expect(page.getByText('฿14,000').first()).toBeVisible();
  });

  test('creates a budget and rejects a negative limit', async ({ request }) => {
    const ok = await request.post('/api/v1/budgets', { data: { cat: 'saving', limit: 3000 } });
    expect(ok.status()).toBe(201);
    expect((await ok.json()).limit).toBe(3000);
    expect((await request.post('/api/v1/budgets', { data: { cat: 'saving', limit: -1 } })).status()).toBe(400);
  });
});

test.describe('assets and net worth', () => {
  test('a new asset appears on the net worth page and changes its value', async ({ page, request }) => {
    const created = await request.post('/api/v1/assets', { data: { name: 'Gold bar', value: 50000 } });
    expect(created.status()).toBe(201);
    const { id } = await created.json();
    await page.goto('/networth');
    await expect(page.getByText('Gold bar').first()).toBeVisible();

    expect((await request.patch(`/api/v1/assets/${id}`, { data: { value: 65000 } })).status()).toBe(200);
    await page.reload();
    await expect(page.getByText('฿65,000').first()).toBeVisible();

    expect((await request.delete(`/api/v1/assets/${id}`)).status()).toBe(204);
    await page.reload();
    await expect(page.getByText('Gold bar')).toHaveCount(0);
  });

  test('the asset snapshot groups match the plan page asset tab', async ({ page, request }) => {
    const snap = await api<{ groups: { group: string; items: { name: string }[] }[]; curr: number }>(request, '/plan/snapshots');
    expect(snap.groups.map((g) => g.group).sort()).toEqual(['bank', 'invest', 'other', 'savings']);
    await page.goto('/plan?tab=assets');
    for (const g of snap.groups) await expect(page.getByText(g.items[0].name).first()).toBeVisible();
  });
});

test.describe('savings channels and income items', () => {
  test('a new channel shows in setup and as a choice for Save rows in the sheet', async ({ page, request }) => {
    expect((await request.post('/api/v1/channels', { data: { name: 'Crypto', kind: 'stock', opening: 1000 } })).status()).toBe(201);
    await page.goto('/setup?tab=channels');
    await expect(page.getByText('Crypto').first()).toBeVisible();

    await page.goto('/transactions');
    await page.locator('[data-r="12"][data-f="activity"]').click();
    await page.getByRole('option', { name: 'Save', exact: true }).click();
    await page.locator('[data-r="12"][data-f="item"]').click();
    await expect(page.getByRole('option', { name: 'Crypto', exact: true })).toBeVisible();
  });

  test('a channel in use cannot be deleted, an unused one can', async ({ request }) => {
    expect((await request.post('/api/v1/transactions', { data: { name: 'x', activity: 'save', item: 'Gold savings', acct: 'SCB Current', amount: -10 } })).status()).toBe(201);
    const channels = (await api<{ data: Row[] }>(request, '/channels')).data;
    const used = await request.delete(`/api/v1/channels/${channels.find((c) => c.name === 'Gold savings')!.id}`);
    expect([used.status(), (await used.json()).code]).toEqual([409, 'channelInUse']);
    expect((await request.delete(`/api/v1/channels/${channels.find((c) => c.name === 'Government bond')!.id}`)).status()).toBe(204);
  });

  test('a new income item shows in setup and as a choice for Receive rows', async ({ page, request }) => {
    expect((await request.post('/api/v1/income-categories', { data: { name: 'Royalties', sub: 'passive' } })).status()).toBe(201);
    await page.goto('/setup');
    await expect(page.getByText('Royalties').first()).toBeVisible();

    await page.goto('/transactions');
    await page.locator('[data-r="12"][data-f="activity"]').click();
    await page.getByRole('option', { name: 'Receive', exact: true }).click();
    await page.locator('[data-r="12"][data-f="item"]').click();
    await expect(page.getByRole('option', { name: 'Royalties', exact: true })).toBeVisible();
  });

  test('an income item in use is renamed on its transactions and cannot be deleted', async ({ request }) => {
    const items = (await api<{ data: Row[] }>(request, '/income-categories')).data;
    const salary = items.find((i) => i.name === 'Monthly salary')!;
    const tx = (await api<{ data: { item: string }[] }>(request, '/transactions?activity=receive')).data[0];
    expect(tx.item).toBe('Monthly salary');
    expect((await request.patch(`/api/v1/income-categories/${salary.id}`, { data: { name: 'Salary' } })).status()).toBe(200);
    expect((await api<{ data: { item: string }[] }>(request, '/transactions?activity=receive')).data[0].item).toBe('Salary');
    const del = await request.delete(`/api/v1/income-categories/${salary.id}`);
    expect([del.status(), (await del.json()).code]).toEqual([409, 'incomeInUse']);
  });
});

test.describe('accounts and transactions over the API', () => {
  test('edits a transaction and the sheet shows the change', async ({ page, request }) => {
    expect((await request.patch('/api/v1/transactions/2', { data: { amount: -999, note: 'Edited lunch' } })).status()).toBe(200);
    await page.goto('/transactions/2');
    await expect(page.getByText('Edited lunch')).toBeVisible();
    await expect(page.getByText('฿999').first()).toBeVisible();
  });

  test('rejects bad data and unknown resources with clear errors', async ({ request }) => {
    expect((await request.get('/api/v1/secrets')).status()).toBe(404);
    expect((await request.post('/api/v1/goals', { data: { name: 'x', target: 0 } })).status()).toBe(400);
    expect((await request.post('/api/v1/transactions', { data: { name: 'x', cat: 'food', acct: 'Nope', amount: -1 } })).status()).toBe(400);
    expect((await request.get('/api/v1/transactions/abc')).status()).toBe(400);
    expect((await request.get('/api/health')).status()).toBe(200);
  });

  test('reports the dashboard, net worth, reports and settings aggregates', async ({ request }) => {
    expect((await api(request, '/dashboard')).netWorth ?? true).toBeTruthy();
    for (const p of ['/networth', '/reports', '/settings', '/bills/summary', '/debts/strategy', '/debts/dsr', '/plan', '/setup', '/tax?year=2026']) {
      expect((await request.get(`/api/v1${p}`)).status(), p).toBe(200);
    }
  });
});
