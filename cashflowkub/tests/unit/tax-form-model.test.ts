import { describe, expect, it } from 'vitest';
import { TAX_SECTIONS, toFormValues, toTaxInput } from '@/app/(app)/tax/form-model';
import { EMPTY_TAX_INPUT } from '@/server/tax/logic';

describe('tax form model', () => {
  it('parses blanks and commas', () => {
    const v = { ...toFormValues(EMPTY_TAX_INPUT), salary: '12,500', freelance: '', rmf: 'abc', spouse: true };
    expect(toTaxInput(v)).toMatchObject({ salary: 12_500, freelance: 0, rmf: 0, spouse: true });
  });
  it('round-trips', () => {
    const input = { ...EMPTY_TAX_INPUT, salary: 600_000, children: 2 };
    expect(toTaxInput(toFormValues(input))).toEqual(input);
  });
  it('every TaxInput field is in exactly one section', () => {
    expect(TAX_SECTIONS.flatMap((s) => s.fields).sort()).toEqual(Object.keys(EMPTY_TAX_INPUT).sort());
  });
});
