import { beforeEach, describe, expect, it } from 'vitest';
import * as plan from '@/app/api/v1/plan/route';
import * as planItem from '@/app/api/v1/plan/[id]/route';
import { call, resetDb } from './helpers';

beforeEach(resetDb);

const create = (body: Record<string, unknown>) => call(plan.POST, { method: 'POST', body });

describe('plan item edge cases', () => {
  it('returns 404 when patching or deleting an unknown item', async () => {
    expect((await call(planItem.PATCH, { method: 'PATCH', params: { id: '999999' }, body: { actual: 1 } })).status).toBe(404);
    expect((await call(planItem.DELETE, { method: 'DELETE', params: { id: '999999' } })).status).toBe(404);
  });

  it('rejects negative or fractional planned and a malformed month', async () => {
    for (const bad of [{ planned: -1 }, { planned: 1.5 }, { month: '2026-6' }]) {
      expect((await create({ type: 'expense', name: 'X', month: '2026-06', ...bad })).status).toBe(400);
    }
    const { json } = await create({ type: 'expense', name: 'X', month: '2026-06' });
    for (const bad of [{ planned: -1 }, { planned: 1.5 }, { month: '2026-6' }]) {
      expect((await call(planItem.PATCH, { method: 'PATCH', params: { id: String(json.id) }, body: bad })).status).toBe(400);
    }
  });

  it('keeps creation order for items that share a sort value', async () => {
    await create({ type: 'expense', name: 'A', month: '2031-01' });
    await create({ type: 'expense', name: 'B', month: '2031-01' });
    const { json } = await call(plan.GET, { url: '/api/v1/plan?month=2031-01' });
    expect(json.expense.items.map((i: { name: string }) => i.name)).toEqual(['A', 'B']);
  });

  it('lets PATCH move an item to another type and month', async () => {
    const { json } = await create({ type: 'expense', name: 'Move', month: '2031-01' });
    const res = await call(planItem.PATCH, { method: 'PATCH', params: { id: String(json.id) }, body: { type: 'savings', month: '2031-02' } });
    expect(res.status).toBe(200);
    const moved = await call(plan.GET, { url: '/api/v1/plan?month=2031-02' });
    expect(moved.json.savings.items.map((i: { name: string }) => i.name)).toEqual(['Move']);
  });

  it('appends a new item after the seeded ones in its month and type', async () => {
    await create({ type: 'expense', name: 'Gifts', month: '2026-06' });
    const { json } = await call(plan.GET, { url: '/api/v1/plan?month=2026-06' });
    expect(json.expense.items.at(-1).name).toBe('Gifts');
  });
});
