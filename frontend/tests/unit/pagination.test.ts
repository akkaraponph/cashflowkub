import { describe, expect, it } from 'vitest';
import { clampPage, pageRange, parsePaging } from '@/lib/pagination';

describe('parsePaging', () => {
  it('defaults to page 1 of 200', () => expect(parsePaging(undefined, undefined)).toEqual({ page: 1, size: 200 }));
  it('accepts listed sizes only', () => {
    expect(parsePaging('2', '50')).toEqual({ page: 2, size: 50 });
    expect(parsePaging('2', '7').size).toBe(200);
  });
  it('treats junk pages as 1', () => {
    for (const p of ['abc', '0', '-3', '1.5', '']) expect(parsePaging(p, undefined).page).toBe(1);
  });
});
describe('clampPage / pageRange', () => {
  it('clamps past the last page and handles empty', () => {
    expect(clampPage(99, 523, 200)).toBe(3);
    expect(clampPage(5, 0, 200)).toBe(1);
  });
  it('reports the visible window', () => {
    expect(pageRange(2, 200, 523)).toEqual({ from: 201, to: 400 });
    expect(pageRange(3, 200, 523)).toEqual({ from: 401, to: 523 });
    expect(pageRange(1, 200, 0)).toEqual({ from: 0, to: 0 });
  });
});
