import { describe, expect, it } from 'vitest';
import { emptyForm, fixedTotal, formFromDebt, formToBody, isFormValid, type DebtForm } from '@/app/(app)/debts/debt-form';
import type { DebtView } from '@/server/views';

const debt = {
  id: 2, name: 'KrungThai Personal', th: 'กรุงไทยใจป้ำ', icon: 'landmark', tint: 'pdf', kind: 'bankloan', lender: 'Krungthai Bank',
  original: 70000, openingPaid: 24300, paid: 24300, apr: 25, calc: 'reducing', monthly: 2783, fixedPayment: 0, termMonths: 0,
  dueDay: 25, graceDays: 3, lateFee: 100, penaltyApr: 0, done: false, revolving: false, sort: 2,
} as unknown as DebtView;

describe('debt form', () => {
  it('formFromDebt shows the rate per year', () => {
    const f = formFromDebt(debt, 'en');
    expect(f).toMatchObject({ kind: 'bankloan', unit: 'year', calc: 'reducing', revolving: false });
    expect(f.fields).toMatchObject({ rate: '25', original: '70000', openingPaid: '24300', termMonths: '0', dueDay: '25' });
  });
  it('round-trips through formToBody', () => {
    expect(formToBody(formFromDebt(debt, 'en'), 'edit')).toEqual({
      name: 'KrungThai Personal', th: 'KrungThai Personal', kind: 'bankloan', lender: 'Krungthai Bank', original: 70000, openingPaid: 24300,
      apr: 25, calc: 'reducing', termMonths: 0, fixedPayment: 0, monthly: 2783, dueDay: 25, graceDays: 3, lateFee: 100, penaltyApr: 0, revolving: false,
    });
  });
  it('add mode also sends the preset icon and tint', () => {
    expect(formToBody({ ...formFromDebt(debt, 'en'), kind: 'bankloan' })).toMatchObject({ icon: 'landmark', tint: 'doc' });
  });
  it('converts a monthly rate to annual', () => {
    const f = { ...emptyForm, unit: 'month' as const, fields: { ...emptyForm.fields, name: 'x', rate: '2.5' } };
    expect(formToBody(f).apr).toBe(30);
  });
  it('trims the name and stores it for both languages', () => {
    const f = { ...emptyForm, fields: { ...emptyForm.fields, name: '  Loan  ' } };
    expect(formToBody(f)).toMatchObject({ name: 'Loan', th: 'Loan' });
  });
  it('edit shows the name in the active language, so saving keeps what the user sees', () => {
    expect(formFromDebt(debt, 'th').fields.name).toBe('กรุงไทยใจป้ำ');
    expect(formToBody(formFromDebt(debt, 'th'), 'edit')).toMatchObject({ name: 'กรุงไทยใจป้ำ', th: 'กรุงไทยใจป้ำ' });
    expect(formFromDebt({ ...debt, th: '' } as typeof debt, 'th').fields.name).toBe('KrungThai Personal');
  });

  const fixedForm = (o: Partial<DebtForm['fields']> = {}): DebtForm => ({
    ...emptyForm, kind: 'personal', calc: 'fixed',
    fields: { ...emptyForm.fields, name: 'iPhone', original: '10000', fixedPayment: '1200', termMonths: '10', ...o },
  });
  it('formFromDebt keeps the fixed method', () => {
    expect(formFromDebt({ ...debt, calc: 'fixed' } as DebtView, 'en').calc).toBe('fixed');
  });
  it('formToBody for fixed sends apr 0 and no minimum payment', () => {
    expect(formToBody(fixedForm({ rate: '30', monthly: '500' }))).toMatchObject({ calc: 'fixed', apr: 0, monthly: 0, fixedPayment: 1200, termMonths: 10 });
  });
  it('isFormValid requires instalment, months, and a total covering the principal', () => {
    expect(isFormValid(fixedForm())).toBe(true);
    expect(isFormValid(fixedForm({ termMonths: '0' }))).toBe(false);
    expect(isFormValid(fixedForm({ fixedPayment: '0' }))).toBe(false);
    expect(isFormValid(fixedForm({ fixedPayment: '999' }))).toBe(false);
  });
  it('fixedTotal multiplies instalment by months', () => {
    expect(fixedTotal(fixedForm())).toBe(12000);
  });
});
