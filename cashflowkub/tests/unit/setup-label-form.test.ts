import { describe, expect, it } from 'vitest';
import { labelPatch, labelPath } from '@/app/(app)/setup/label-form';

describe('labelPatch', () => {
  it('trims and uses the expense field names', () => {
    expect(labelPatch('expense', '  Groceries ', ' ของชำ ')).toEqual({ label: 'Groceries', th: 'ของชำ' });
  });
  it('uses the income field names', () => {
    expect(labelPatch('income', 'Salary', 'เงินเดือน')).toEqual({ name: 'Salary', th: 'เงินเดือน' });
  });
  it('allows a blank Thai name', () => {
    expect(labelPatch('expense', 'Food', '')).toEqual({ label: 'Food', th: '' });
  });
  it('rejects a blank English name', () => {
    expect(labelPatch('expense', '   ', 'x')).toBeNull();
    expect(labelPatch('income', '', '')).toBeNull();
  });
  it('maps kinds to API paths', () => {
    expect(labelPath).toEqual({ expense: '/categories', income: '/income-categories' });
  });
});
