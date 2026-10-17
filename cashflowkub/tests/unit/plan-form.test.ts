import { describe, expect, it } from 'vitest';
import { emptyPlanForm, formFromPlanItem, planItemBody } from '@/app/(app)/plan/plan-form';

const ctx = { type: 'expense', month: '2026-06' } as const;
const item = { name: 'Rent', th: 'ค่าเช่า', planned: 12000, actual: 11000 };

describe('plan item form', () => {
  it('rejects a blank name', () => {
    expect(planItemBody({ ...emptyPlanForm, name: '   ' }, ctx)).toBeNull();
  });
  it('rejects negative or unreadable amounts', () => {
    expect(planItemBody({ name: 'X', planned: '-1', actual: '' }, ctx)).toBeNull();
    expect(planItemBody({ name: 'X', planned: '', actual: 'abc' }, ctx)).toBeNull();
  });
  it('builds a create body; blank amounts are 0, ฿ and commas are stripped', () => {
    expect(planItemBody({ name: ' Rent ', planned: '฿12,000', actual: '' }, ctx)).toEqual({
      type: 'expense', month: '2026-06', name: 'Rent', th: 'Rent', planned: 12000, actual: 0,
    });
  });
  it('reads spaces in amounts and rounds fractions', () => {
    expect(planItemBody({ name: 'X', planned: '1 200', actual: '12.5' }, ctx)).toMatchObject({ planned: 1200, actual: 13 });
  });
  it('shows the name in the current language', () => {
    expect(formFromPlanItem(item, 'th')).toEqual({ name: 'ค่าเช่า', planned: '12000', actual: '11000' });
    expect(formFromPlanItem(item, 'en').name).toBe('Rent');
  });
  it('edit leaves an unchanged name, type and month out', () => {
    const f = formFromPlanItem(item, 'th');
    expect(planItemBody({ ...f, planned: '13000' }, ctx, f)).toEqual({ planned: 13000, actual: 11000 });
  });
  it('edit sends a changed name for both languages', () => {
    const f = formFromPlanItem(item, 'th');
    expect(planItemBody({ ...f, name: 'Condo' }, ctx, f)).toMatchObject({ name: 'Condo', th: 'Condo' });
  });
});
