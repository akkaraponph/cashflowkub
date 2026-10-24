import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api-client';
import { errorText } from '@/lib/api-error';
import { DICT } from '@/lib/i18n';

describe('errorText', () => {
  it('maps a known code to the dictionary in the active language', () => {
    const err = new ApiError(400, 'x', 'originalBelowRepaid');
    expect(errorText(err, DICT.th)).toBe(DICT.th.errors.originalBelowRepaid);
    expect(errorText(err, DICT.en)).toBe(DICT.en.errors.originalBelowRepaid);
  });
  it('falls back to the message for unknown or missing codes', () => {
    expect(errorText(new ApiError(400, 'x', 'zzz'), DICT.th)).toBe('x');
    expect(errorText(new ApiError(500, 'boom'), DICT.th)).toBe('boom');
  });
  it('handles non-API errors', () => {
    expect(errorText(new TypeError('network down'), DICT.th)).toBe('network down');
    expect(errorText('weird', DICT.th)).toBe('weird');
  });
  it('Thai error copy is Thai', () => {
    for (const text of Object.values(DICT.th.errors)) expect(text).toMatch(/[฀-๿]/);
  });
});
