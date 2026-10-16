import { describe, expect, it } from 'vitest';
import { rulesFor, TAX_RULES_2025 } from '@/server/tax/rules';
import { computeTax, EMPTY_TAX_INPUT, hasUsefulRoom, taxOnNet, type DeductionKey, type TaxInput } from '@/server/tax/logic';

const base = (p: Partial<TaxInput>): TaxInput => ({ ...EMPTY_TAX_INPUT, ...p });
const R = TAX_RULES_2025;

describe('taxOnNet', () => {
  it('walks the brackets', () => {
    expect(taxOnNet(150_000, R.brackets).tax).toBe(0);
    expect(taxOnNet(300_000, R.brackets).tax).toBe(7_500);
    expect(taxOnNet(1_000_000, R.brackets).tax).toBe(115_000);
    expect(taxOnNet(5_000_000, R.brackets)).toMatchObject({ tax: 1_265_000, marginalRate: 0.3 });
    expect(taxOnNet(0, R.brackets)).toEqual({ bands: [], tax: 0, marginalRate: 0 });
  });
});

describe('computeTax', () => {
  it('salaried with social security owes a little more than withheld', () => {
    const r = computeTax(base({ salary: 600_000, socialSecurity: 9_000, withheld: 20_000 }), R);
    expect(r).toMatchObject({ income: 600_000, expense: 100_000, totalDeductions: 69_000, netIncome: 431_000, tax: 20_600, balance: 600, marginalRate: 0.1 });
    expect(r.effectiveRate).toBeCloseTo(20_600 / 600_000, 6);
  });
  it('negative balance means a refund', () => {
    expect(computeTax(base({ salary: 600_000, withheld: 30_000 }), R)).toMatchObject({ tax: 21_500, balance: -8_500 });
  });
  it('applies life+health and retirement-group caps', () => {
    const r = computeTax(base({ salary: 1_200_000, lifeInsurance: 120_000, healthInsurance: 30_000, rmf: 400_000, ssf: 250_000 }), R);
    const line = (k: DeductionKey) => r.deductions.find((d) => d.key === k);
    expect(line('lifeInsurance')).toEqual({ key: 'lifeInsurance', claimed: 120_000, allowed: 100_000, capped: true });
    expect(line('healthInsurance')).toEqual({ key: 'healthInsurance', claimed: 30_000, allowed: 0, capped: true });
    expect(line('rmf')).toEqual({ key: 'rmf', claimed: 400_000, allowed: 360_000, capped: true });
    expect(line('ssf')).toEqual({ key: 'ssf', claimed: 250_000, allowed: 140_000, capped: true });
    expect(r).toMatchObject({ totalDeductions: 660_000, netIncome: 440_000, tax: 21_500, room: { rmf: 0, ssf: 0, thaiEsg: 300_000 } });
  });
  it('caps donations at 10% of income after deductions, double ones first', () => {
    expect(computeTax(base({ salary: 300_000, donation: 50_000 }), R)).toMatchObject({ netIncome: 126_000, tax: 0 });
    expect(computeTax(base({ salary: 500_000, donationDouble: 10_000 }), R)).toMatchObject({ netIncome: 320_000, tax: 9_500 });
  });
  it('counts children, the 2018+ extra, and at most 4 parents', () => {
    const r = computeTax(base({ salary: 1_000_000, children: 2, children2018Extra: 1, parents: 4, spouse: true }), R);
    expect(r.deductions.find((d) => d.key === 'children')?.allowed).toBe(90_000);
    expect(r.deductions.find((d) => d.key === 'parents')?.allowed).toBe(120_000);
    expect(r.deductions.find((d) => d.key === 'spouse')?.allowed).toBe(60_000);
  });
  it('zero income never goes negative or NaN', () => {
    const r = computeTax(base({ lifeInsurance: 50_000, rmf: 100_000 }), R);
    expect(r).toMatchObject({ income: 0, netIncome: 0, tax: 0, effectiveRate: 0, marginalRate: 0, room: { rmf: 0, ssf: 0, thaiEsg: 0 } });
  });
  it('assumed years use 2025 rules without Easy E-Receipt', () => {
    expect(rulesFor(2025)).toMatchObject({ rulesYear: 2025, assumed: false });
    const { rules, assumed } = rulesFor(2026);
    expect(assumed).toBe(true);
    const r = computeTax(base({ salary: 600_000, easyEReceipt: 50_000 }), rules);
    expect(r.deductions.find((d) => d.key === 'easyEReceipt')).toEqual({ key: 'easyEReceipt', claimed: 50_000, allowed: 0, capped: true });
  });
});

describe('hasUsefulRoom', () => {
  it('is false when there is no tax to cut, true when there is room and tax', () => {
    expect(hasUsefulRoom(computeTax(base({ salary: 300_000 }), R))).toBe(false);
    expect(hasUsefulRoom(computeTax(base({ salary: 1_200_000 }), R))).toBe(true);
    expect(hasUsefulRoom(computeTax(base({ salary: 1_200_000, rmf: 360_000, ssf: 140_000, thaiEsg: 300_000 }), R))).toBe(false);
  });
});
