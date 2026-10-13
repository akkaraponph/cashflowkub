import { describe, expect, it } from 'vitest';
import { applyPaid, buildBillSummary } from '@/server/bill/logic';
import { bill } from '../fixtures';

describe('buildBillSummary', () => {
  it('totals paid vs remaining and picks the first unpaid as next', () => {
    const bills = [
      bill({ id: 1, amount: 149, dueDay: 1, paid: true }),
      bill({ id: 2, amount: 2500, dueDay: 16 }),
      bill({ id: 3, amount: 180, dueDay: 20 }),
    ];
    const s = buildBillSummary(bills, [], 18, '2026-06');
    expect(s).toMatchObject({ total: 2829, paid: 149, remaining: 2680, count: 3, month: '2026-06', today: 18 });
    expect(s.nextBill).toMatchObject({ id: 2, status: 'overdue', daysDiff: -2 });
  });
  it('has no next bill when everything is paid', () => {
    expect(buildBillSummary([bill({ paid: true })], [], 18, '2026-06').nextBill).toBeNull();
  });
});

describe('applyPaid', () => {
  it('toggles when no value is given and sets when one is', () => {
    expect(applyPaid(bill({ paid: false }), undefined).paid).toBe(true);
    expect(applyPaid(bill({ paid: true }), undefined).paid).toBe(false);
    expect(applyPaid(bill({ paid: true }), true).paid).toBe(true);
  });
});
