import { describe, expect, it } from 'vitest';
import { DICT, localized } from '@/lib/i18n';

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
