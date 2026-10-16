import { beforeEach, describe, expect, it } from 'vitest';
import * as tax from '@/app/api/v1/tax/route';
import { prisma } from '@/lib/db';
import { EMPTY_TAX_INPUT } from '@/server/tax/logic';
import { call, resetDb } from './helpers';

beforeEach(resetDb);

const put = (body: unknown, year = 2025) => call(tax.PUT, { method: 'PUT', url: `/api/v1/tax?year=${year}`, body });

describe('/api/v1/tax', () => {
  it('defaults to monthly income × 12 when nothing is saved', async () => {
    const { status, json } = await call(tax.GET, { url: '/api/v1/tax?year=2025' });
    expect(status).toBe(200);
    expect(json).toMatchObject({ year: 2025, rulesYear: 2025, assumed: false, saved: false, input: { salary: 744_000 } });
  });
  it('saves per year and recomputes', async () => {
    const body = { ...EMPTY_TAX_INPUT, salary: 600_000, socialSecurity: 9_000, withheld: 20_000 };
    expect((await put(body)).json).toMatchObject({ saved: true, result: { tax: 20_600, balance: 600 } });
    expect((await call(tax.GET, { url: '/api/v1/tax?year=2025' })).json.saved).toBe(true);
    expect((await call(tax.GET, { url: '/api/v1/tax?year=2026' })).json).toMatchObject({ saved: false, assumed: true });
  });
  it('400s bad input', async () => {
    expect((await put({ ...EMPTY_TAX_INPUT, salary: -1 })).status).toBe(400);
    expect((await put({ ...EMPTY_TAX_INPUT, salary: 1.5 })).status).toBe(400);
    expect((await put({ ...EMPTY_TAX_INPUT, parents: 5 })).status).toBe(400);
    expect((await put({ ...EMPTY_TAX_INPUT, children: 2, children2018Extra: 2 })).status).toBe(400);
    expect((await put({ ...EMPTY_TAX_INPUT, salary: null })).status).toBe(400);
    expect((await put({ ...EMPTY_TAX_INPUT, bogus: 1 })).status).toBe(400);
  });
  it('400s a bad year', async () => {
    for (const y of ['abc', '1999.5', '1999', '2101']) expect((await call(tax.GET, { url: `/api/v1/tax?year=${y}` })).status).toBe(400);
  });
  it('treats a corrupt stored plan as unsaved', async () => {
    await prisma.setting.create({ data: { key: 'tax:2025', value: '{not json' } });
    expect((await call(tax.GET, { url: '/api/v1/tax?year=2025' })).json).toMatchObject({ saved: false });
    await prisma.setting.update({ where: { key: 'tax:2025' }, data: { value: '{"salary":"old"}' } });
    expect((await call(tax.GET, { url: '/api/v1/tax?year=2025' })).json).toMatchObject({ saved: false });
  });
});
