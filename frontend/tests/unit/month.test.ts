import { describe, expect, it } from 'vitest';
import { resolveMonth } from '@/lib/month';

describe('resolveMonth', () => {
  it('keeps a valid month', () => expect(resolveMonth('2026-07', '2026-06')).toBe('2026-07'));
  it.each([undefined, 'garbage', '2026-13', '2026-7', ''])('falls back for %s', (raw) => {
    expect(resolveMonth(raw, '2026-06')).toBe('2026-06');
  });
});
