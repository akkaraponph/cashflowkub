import { describe, expect, it } from 'vitest';
import { buildBillSummary } from '@/server/bill/logic';
import { billView } from '../fixtures';

describe('buildBillSummary', () => {
  it('totals paid vs remaining and picks the first unpaid as next', () => {
    const bills = [
      billView({ id: 1, amount: 149, dueDay: 1, paid: true, status: 'paid', daysDiff: -17 }),
      billView({ id: 2, amount: 2500, dueDay: 16, status: 'overdue', daysDiff: -2 }),
      billView({ id: 3, amount: 180, dueDay: 20 }),
    ];
    const s = buildBillSummary(bills, [], 18, '2026-06');
    expect(s).toMatchObject({ total: 2829, paid: 149, remaining: 2680, count: 3, month: '2026-06', today: 18 });
    expect(s.nextBill).toMatchObject({ id: 2, status: 'overdue', daysDiff: -2 });
  });
  it('has no next bill when everything is paid', () => {
    expect(buildBillSummary([billView({ paid: true, status: 'paid' })], [], 18, '2026-06').nextBill).toBeNull();
  });
});
