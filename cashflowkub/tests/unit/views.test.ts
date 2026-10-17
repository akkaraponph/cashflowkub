import { describe, expect, it } from 'vitest';
import { toBillView } from '@/server/views';
import { bill, debtView, payment } from '../fixtures';

describe('toDebtView', () => {
  it('derives remaining, progress, instalment and payoff from terms', () => {
    const v = debtView({ original: 20000, paid: 5001, apr: 18, calc: 'flat', termMonths: 12, monthly: 0, dueDay: 5, lateFee: 100 });
    expect(v).toMatchObject({ remaining: 14999, installment: 1967, monthsLeft: 9, payoff: 'Mar 2027', payoffTh: 'มี.ค. 2027', totalInterestLeft: 2700, neverPaysOff: false });
    expect(v.due).toMatchObject({ state: 'overdue', lateFee: 100 });
  });
  it('uses payments to decide the due state and drops the payments array', () => {
    const v = debtView({ dueDay: 1, fixedPayment: 1250, original: 7500, paid: 3750 }, [payment({ amount: 1250 })]);
    expect(v.due.state).toBe('paid');
    expect(v).not.toHaveProperty('payments');
  });
  it('closed debts have no instalment or payoff', () => {
    expect(debtView({ original: 100, paid: 100, done: true })).toMatchObject({ remaining: 0, installment: 0, payoff: '', monthsLeft: 0 });
  });
  it('marks a debt whose payment never clears the interest', () => {
    expect(debtView({ original: 10000, apr: 60, monthly: 400 })).toMatchObject({ neverPaysOff: true, payoff: '—' });
  });
});

describe('toBillView', () => {
  const today = new Date(Date.UTC(2026, 5, 18));
  const view = (o: Parameters<typeof bill>[0], month = '2026-06', paid = false) => toBillView(bill(o), { month, paid, today });

  it.each([
    [{ dueDay: 1 }, true, 'paid', -17],
    [{ dueDay: 16 }, false, 'overdue', -2],
    [{ dueDay: 18 }, false, 'dueToday', 0],
    [{ dueDay: 23 }, false, 'dueSoon', 5],
    [{ dueDay: 24 }, false, 'upcoming', 6],
  ] as const)('%o paid=%s -> %s', (o, paid, status, diff) => {
    const v = view(o, '2026-06', paid);
    expect(v).toMatchObject({ status, daysDiff: diff, paid, month: '2026-06' });
  });
  it('carries the due date for the viewed month', () => {
    expect(view({ dueDay: 16 }).dueDate).toBe('2026-06-16');
  });
  it('an unpaid bill in a past month is overdue by the whole gap', () => {
    const v = view({ dueDay: 1 }, '2026-05');
    expect(v.status).toBe('overdue');
    expect(v.daysDiff).toBe(-48);
  });
  it('a bill due in a later month is upcoming', () => {
    expect(view({ dueDay: 1 }, '2026-08').status).toBe('upcoming');
  });
  it('a due day past the end of the month lands on the last day', () => {
    expect(view({ dueDay: 31 }, '2027-02').dueDate).toBe('2027-02-28');
  });
});
