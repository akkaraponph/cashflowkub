import { describe, expect, it } from 'vitest';
import { labelPatch, labelPath } from '@/app/(app)/setup/label-form';

describe('labelPatch', () => {
  it('trims and stores one name for both languages (expense)', () => {
    expect(labelPatch('expense', '  Groceries ')).toEqual({ label: 'Groceries', th: 'Groceries' });
  });
  it('stores one name for both languages (income)', () => {
    expect(labelPatch('income', 'เงินเดือน')).toEqual({ name: 'เงินเดือน', th: 'เงินเดือน' });
  });
  it('rejects a blank name', () => {
    expect(labelPatch('expense', '   ')).toBeNull();
    expect(labelPatch('income', '')).toBeNull();
  });
  it('maps kinds to API paths', () => {
    expect(labelPath).toEqual({ expense: '/categories', income: '/income-categories' });
  });
});
