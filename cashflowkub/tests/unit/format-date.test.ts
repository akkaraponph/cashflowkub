import { describe, expect, it } from 'vitest';
import { formatDay, formatMonth } from '@/lib/format';

describe('formatDay', () => {
  it('formats in Thai and English', () => {
    expect(formatDay('2026-06-28', 'th')).toBe('28 มิ.ย. 2026');
    expect(formatDay('2026-06-28', 'en')).toBe('28 Jun 2026');
  });
  it('has no leading zero and handles year edges', () => {
    expect(formatDay('2026-01-01', 'th')).toBe('1 ม.ค. 2026');
    expect(formatDay('2026-12-31', 'th')).toBe('31 ธ.ค. 2026');
  });
  it('returns bad input unchanged', () => {
    expect(formatDay('', 'th')).toBe('');
    expect(formatDay('not-a-date', 'th')).toBe('not-a-date');
    expect(formatDay('2026-13-40', 'th')).toBe('2026-13-40');
  });
});

describe('formatMonth', () => {
  it('formats a YYYY-MM month in Thai and English', () => {
    expect(formatMonth('2026-06', 'en')).toBe('Jun 2026');
    expect(formatMonth('2026-12', 'th')).toBe('ธ.ค. 2026');
  });
  it('returns anything unparseable as given', () => {
    expect(formatMonth('garbage', 'en')).toBe('garbage');
  });
});
