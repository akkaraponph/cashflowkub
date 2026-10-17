import { describe, expect, it } from 'vitest';
import { billBody, emptyBillForm, formFromBill } from '@/app/(app)/bills/bill-form';

const bill = { id: 2, name: 'Netflix Premium', th: 'Netflix Premium', icon: 'clapperboard', tint: 'video', amount: 419, dueDay: 3, paid: true, freq: 'monthly', cat: 'fun', kind: 'subscription', startMonth: '2026-06', endMonth: '', everyMonths: 1, sort: 2 };

describe('bill form', () => {
  it('rejects a blank name, a bad due day and a negative amount', () => {
    expect(billBody({ ...emptyBillForm, name: ' ', amount: '10' })).toBeNull();
    expect(billBody({ ...emptyBillForm, name: 'X', amount: '10', dueDay: '0' })).toBeNull();
    expect(billBody({ ...emptyBillForm, name: 'X', amount: '10', dueDay: '32' })).toBeNull();
    expect(billBody({ ...emptyBillForm, name: 'X', amount: '-5' })).toBeNull();
  });
  it('add mode stores one name for both languages plus the kind preset icon', () => {
    expect(billBody({ ...emptyBillForm, name: ' Water ', kind: 'bill', amount: '1,200', dueDay: '5', freq: 'monthly', cat: 'bills' })).toEqual({
      name: 'Water', th: 'Water', kind: 'bill', amount: 1200, dueDay: 5, freq: 'monthly', cat: 'bills', icon: 'receipt', tint: 'pdf',
      startMonth: '2026-06', endMonth: '', everyMonths: 1,
    });
  });
  it('a subscription gets its own preset', () => {
    expect(billBody({ ...emptyBillForm, name: 'Disney+', kind: 'subscription', amount: '99', cat: 'fun' })).toMatchObject({ icon: 'cloud', tint: 'image', kind: 'subscription' });
  });
  it('edit shows the displayed name and keeps the stored icon unless the kind changes', () => {
    const f = formFromBill(bill, 'en');
    expect(f).toEqual({ name: 'Netflix Premium', kind: 'subscription', amount: '419', dueDay: '3', freq: 'monthly', cat: 'fun', startMonth: '2026-06', endMonth: '', everyMonths: '1', date: '2026-06-03' });
    expect(billBody(f, 'subscription')).not.toHaveProperty('icon');
    expect(billBody({ ...f, kind: 'bill' }, 'subscription')).toMatchObject({ icon: 'receipt', tint: 'pdf' });
  });
  it('edit shows the Thai name when the UI is Thai', () => {
    expect(formFromBill({ ...bill, name: 'Apartment Rent', th: 'ค่าเช่าบ้าน' }, 'th').name).toBe('ค่าเช่าบ้าน');
  });
  it('falls back to bill for an unknown stored kind', () => {
    expect(formFromBill({ ...bill, kind: 'weird' }, 'en').kind).toBe('bill');
  });
  it('adds the recurrence fields to the body', () => {
    expect(billBody({ ...emptyBillForm, name: 'Insurance', amount: '3000', everyMonths: '3', startMonth: '2026-08', endMonth: '2027-02' }))
      .toMatchObject({ everyMonths: 3, startMonth: '2026-08', endMonth: '2027-02', freq: 'monthly' });
  });
  it('a one-time bill is set by its date: month and due day come from it', () => {
    expect(billBody({ ...emptyBillForm, name: 'Fine', amount: '500', freq: 'once', date: '2026-09-23', dueDay: '1', startMonth: 'junk', everyMonths: '6', endMonth: '2027-01' }))
      .toMatchObject({ freq: 'once', startMonth: '2026-09', dueDay: 23, everyMonths: 1, endMonth: '' });
  });
  it('rejects a one-time bill with a blank or impossible date', () => {
    const once = { ...emptyBillForm, name: 'Fine', amount: '500', freq: 'once' as const };
    expect(billBody({ ...once, date: '' })).toBeNull();
    expect(billBody({ ...once, date: '2026-02-30' })).toBeNull();
  });
  it('rejects a bad start month, an end before the start, and a period outside 1-12', () => {
    const ok = { ...emptyBillForm, name: 'X', amount: '10' };
    expect(billBody({ ...ok, startMonth: 'soon' })).toBeNull();
    expect(billBody({ ...ok, startMonth: '2026-08', endMonth: '2026-07' })).toBeNull();
    expect(billBody({ ...ok, everyMonths: '0' })).toBeNull();
    expect(billBody({ ...ok, everyMonths: '13' })).toBeNull();
    expect(billBody({ ...ok, everyMonths: '1.5' })).toBeNull();
  });
  it('edit mode round-trips the recurrence fields and shows a one-time bill as a date', () => {
    const f = formFromBill({ ...bill, startMonth: '2026-06', endMonth: '', everyMonths: 3 }, 'en');
    expect(f).toMatchObject({ startMonth: '2026-06', endMonth: '', everyMonths: '3' });
    expect(formFromBill({ ...bill, freq: 'once', startMonth: '2026-09', dueDay: 23, endMonth: '', everyMonths: 1 }, 'en').date).toBe('2026-09-23');
  });
});
