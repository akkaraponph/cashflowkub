import { describe, expect, it } from 'vitest';
import { byKey, firstParam } from '@/lib/search-params';
import { category } from '../fixtures';

describe('search params helpers', () => {
  it('firstParam takes the first value of repeated params', () => {
    expect(firstParam({ type: ['income', 'expense'] }, 'type')).toBe('income');
    expect(firstParam({ type: 'expense' }, 'type')).toBe('expense');
    expect(firstParam({}, 'type')).toBeUndefined();
  });
  it('byKey indexes categories by slug', () => {
    expect(byKey([category({ key: 'food' })]).get('food')?.label).toBe('Food');
  });
});
