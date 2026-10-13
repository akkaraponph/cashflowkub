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
  it.each([
    [{ paid: true, dueDay: 1 }, 'paid', -17],
    [{ dueDay: 16 }, 'overdue', -2],
    [{ dueDay: 18 }, 'dueToday', 0],
    [{ dueDay: 23 }, 'dueSoon', 5],
    [{ dueDay: 24 }, 'upcoming', 6],
  ] as const)('%o -> %s', (o, status, diff) => {
    const v = toBillView(bill(o), 18);
    expect(v.status).toBe(status);
    expect(v.daysDiff).toBe(diff);
  });
});
