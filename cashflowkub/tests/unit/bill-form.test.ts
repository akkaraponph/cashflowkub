import { describe, expect, it } from 'vitest';
import { billBody, emptyBillForm, formFromBill } from '@/app/(app)/bills/bill-form';

const bill = { id: 2, name: 'Netflix Premium', th: 'Netflix Premium', icon: 'clapperboard', tint: 'video', amount: 419, dueDay: 3, paid: true, freq: 'monthly', cat: 'fun', kind: 'subscription', sort: 2 };

describe('bill form', () => {
  it('rejects a blank name, a bad due day and a negative amount', () => {
    expect(billBody({ ...emptyBillForm, name: ' ', amount: '10' })).toBeNull();
    expect(billBody({ ...emptyBillForm, name: 'X', amount: '10', dueDay: '0' })).toBeNull();
    expect(billBody({ ...emptyBillForm, name: 'X', amount: '10', dueDay: '32' })).toBeNull();
    expect(billBody({ ...emptyBillForm, name: 'X', amount: '-5' })).toBeNull();
  });
  it('add mode stores one name for both languages plus the kind preset icon', () => {
    expect(billBody({ name: ' Water ', kind: 'bill', amount: '1,200', dueDay: '5', freq: 'monthly', cat: 'bills' })).toEqual({
      name: 'Water', th: 'Water', kind: 'bill', amount: 1200, dueDay: 5, freq: 'monthly', cat: 'bills', icon: 'receipt', tint: 'pdf',
    });
  });
  it('a subscription gets its own preset', () => {
    expect(billBody({ ...emptyBillForm, name: 'Disney+', kind: 'subscription', amount: '99', cat: 'fun' })).toMatchObject({ icon: 'cloud', tint: 'image', kind: 'subscription' });
  });
  it('edit shows the displayed name and keeps the stored icon unless the kind changes', () => {
    const f = formFromBill(bill, 'en');
    expect(f).toEqual({ name: 'Netflix Premium', kind: 'subscription', amount: '419', dueDay: '3', freq: 'monthly', cat: 'fun' });
    expect(billBody(f, 'subscription')).not.toHaveProperty('icon');
    expect(billBody({ ...f, kind: 'bill' }, 'subscription')).toMatchObject({ icon: 'receipt', tint: 'pdf' });
  });
  it('edit shows the Thai name when the UI is Thai', () => {
    expect(formFromBill({ ...bill, name: 'Apartment Rent', th: 'ค่าเช่าบ้าน' }, 'th').name).toBe('ค่าเช่าบ้าน');
  });
  it('falls back to bill for an unknown stored kind', () => {
    expect(formFromBill({ ...bill, kind: 'weird' }, 'en').kind).toBe('bill');
  });
});
