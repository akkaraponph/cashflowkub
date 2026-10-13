import { beforeEach, describe, expect, it } from 'vitest';
import * as settings from '@/app/api/v1/settings/route';
import { GET as strategy } from '@/app/api/v1/debts/strategy/route';
import { GET as dsr } from '@/app/api/v1/debts/dsr/route';
import { call, resetDb } from './helpers';

beforeEach(resetDb);

describe('settings', () => {
  it('reads and updates monthly income', async () => {
    expect((await call(settings.GET)).json).toEqual({ monthlyIncome: 62000 });
    expect((await call(settings.PUT, { method: 'PUT', body: { monthlyIncome: 70000 } })).json).toEqual({ monthlyIncome: 70000 });
    expect((await call(settings.GET)).json).toEqual({ monthlyIncome: 70000 });
  });
  it('rejects non-numeric income', async () => {
    expect((await call(settings.PUT, { method: 'PUT', body: { monthlyIncome: 'abc' } })).status).toBe(400);
    expect((await call(settings.PUT, { method: 'PUT', body: {} })).status).toBe(400);
  });
  it('rejects negative or fractional income', async () => {
    expect((await call(settings.PUT, { method: 'PUT', body: { monthlyIncome: -1 } })).status).toBe(400);
    expect((await call(settings.PUT, { method: 'PUT', body: { monthlyIncome: 1.5 } })).status).toBe(400);
  });
});

describe('GET /api/v1/debts/dsr', () => {
  it('computes DSR and the smart plan for the demo data', async () => {
    const { json } = await call(dsr, { url: '/api/v1/debts/dsr' });
    expect(json.dsr).toMatchObject({ income: 62000, monthlyDebt: 14035, band: 'healthy' });
    expect(json.dsr.ratio).toBeCloseTo(0.2264, 4);
    expect(json.actions).toEqual([
      { key: 'payOverdue', debtId: 16, amount: 2067 },
      { key: 'focusHighestRate', debtId: 5 },
      { key: 'refinance', debtId: 2 },
    ]);
  });
  it('honours a stricter target', async () => {
    const { json } = await call(dsr, { url: '/api/v1/debts/dsr?target=0.2' });
    expect(json.monthlyCut).toBe(1635);
    expect(json.actions.map((a: { key: string }) => a.key)).toContain('cutDsr');
  });
  it('asks for income when it is zero, without Infinity', async () => {
    await call(settings.PUT, { method: 'PUT', body: { monthlyIncome: 0 } });
    const { status, json } = await call(dsr, { url: '/api/v1/debts/dsr' });
    expect(status).toBe(200);
    expect(json.dsr.ratio).toBeNull();
    expect(json.actions[0]).toEqual({ key: 'setIncome' });
  });
  it('400s a target outside (0, 1]', async () => {
    expect((await call(dsr, { url: '/api/v1/debts/dsr?target=0' })).status).toBe(400);
    expect((await call(dsr, { url: '/api/v1/debts/dsr?target=abc' })).status).toBe(400);
    expect((await call(dsr, { url: '/api/v1/debts/dsr?target=-0.2' })).status).toBe(400);
    expect((await call(dsr, { url: '/api/v1/debts/dsr?target=1.5' })).status).toBe(400);
    expect((await call(dsr, { url: '/api/v1/debts/dsr?target=NaN' })).status).toBe(400);
  });
});

describe('GET /api/v1/debts/strategy', () => {
  it('compares a strategy with extra money against minimums only', async () => {
    const { json } = await call(strategy, { url: '/api/v1/debts/strategy?strategy=avalanche&extra=2000' });
    expect(json.plan).toMatchObject({ strategy: 'avalanche', extra: 2000, neverPaysOff: false });
    expect(json.plan.order).toHaveLength(7);
    expect(json.plan.months).toBeLessThan(json.baseline.months);
    expect(json.interestSaved).toBeGreaterThan(0);
  });
  it('defaults to avalanche with no extra and 400s bad extra', async () => {
    expect((await call(strategy, { url: '/api/v1/debts/strategy' })).json.plan).toMatchObject({ strategy: 'avalanche', extra: 0 });
    expect((await call(strategy, { url: '/api/v1/debts/strategy?extra=-5' })).status).toBe(400);
    expect((await call(strategy, { url: '/api/v1/debts/strategy?extra=lots' })).status).toBe(400);
    expect((await call(strategy, { url: '/api/v1/debts/strategy?extra=NaN' })).status).toBe(400);
    expect((await call(strategy, { url: '/api/v1/debts/strategy?extra=1.5' })).status).toBe(400);
  });
  it('exposes neverPaysOff flags on baseline and plan so savings can be qualified', async () => {
    const { json } = await call(strategy, { url: '/api/v1/debts/strategy?extra=0' });
    expect(typeof json.baseline.neverPaysOff).toBe('boolean');
    expect(typeof json.plan.neverPaysOff).toBe('boolean');
  });
});
