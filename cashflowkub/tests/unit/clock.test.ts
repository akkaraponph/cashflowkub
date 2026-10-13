import { describe, expect, it } from 'vitest';
import { CURRENT_MONTH, today, todayDay } from '@/lib/clock';

describe('clock', () => {
  it('is pinned to the design reference date', () => {
    expect(today().toISOString()).toBe('2026-06-18T00:00:00.000Z');
    expect(todayDay()).toBe(18);
    expect(CURRENT_MONTH).toBe('2026-06');
  });
  it('returns a copy callers cannot mutate', () => {
    const t = today();
    t.setUTCDate(1);
    expect(todayDay()).toBe(18);
  });
});
