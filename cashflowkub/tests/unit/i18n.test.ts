import { describe, expect, it } from 'vitest';
import { DICT, fill, localized, pickLabel } from '@/lib/i18n';
import { EMPTY_TAX_INPUT } from '@/server/tax/logic';

describe('i18n', () => {
  it('has Thai copy for screen names', () => {
    expect(DICT.en.nav.debts).toBe('Debts');
    expect(DICT.th.nav.networth).toBe('ความมั่งคั่งสุทธิ');
  });
  it('localized prefers Thai only when present', () => {
    expect(localized('th', 'Loan', 'เงินกู้')).toBe('เงินกู้');
    expect(localized('th', 'Loan', '')).toBe('Loan');
    expect(localized('en', 'Loan', 'เงินกู้')).toBe('Loan');
  });
});

describe('i18n helpers', () => {
  it('fill replaces {placeholders}', () => {
    expect(fill('in {n} days', { n: 3 })).toBe('in 3 days');
    expect(fill(DICT.th.action.payOverdue, { debt: 'EasyCash', amount: '฿2,067' })).toContain('EasyCash');
  });
  it('pickLabel falls back to the raw key', () => {
    expect(pickLabel(DICT.en.debtKind, 'paylater')).toBe('PayLater');
    expect(pickLabel(DICT.th.debtKind, 'bankloan')).toBe('สินเชื่อธนาคาร');
    expect(pickLabel(DICT.en.debtKind, 'mystery')).toBe('mystery');
  });
});

describe('tax copy', () => {
  it('has a Thai nav label and a label for every tax field', () => {
    expect(DICT.th.nav.tax).toBe('ภาษี');
    for (const key of Object.keys(EMPTY_TAX_INPUT)) {
      expect(DICT.th.tax.field[key as keyof typeof EMPTY_TAX_INPUT], key).toBeTruthy();
      expect(DICT.en.tax.field[key as keyof typeof EMPTY_TAX_INPUT], key).toBeTruthy();
    }
  });
});

describe('plan CRUD copy', () => {
  it.each(['addPlanItem', 'editPlanItem', 'confirmDeletePlanItem', 'noPlanItems'] as const)('has en and th %s', (key) => {
    expect(DICT.en[key]).not.toBe('');
    expect(DICT.th[key]).not.toBe('');
  });
});
