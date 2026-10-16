// Form state for the tax planner: text fields in, a clean TaxInput out.
import { EMPTY_TAX_INPUT, type TaxInput } from '@/server/tax/logic';

export type TaxFormValues = { [K in keyof TaxInput]: TaxInput[K] extends boolean ? boolean : string };

export const TAX_SECTIONS: { key: 'income' | 'family' | 'insurance' | 'other'; fields: (keyof TaxInput)[] }[] = [
  { key: 'income', fields: ['salary', 'freelance', 'otherNet', 'withheld'] },
  { key: 'family', fields: ['spouse', 'children', 'children2018Extra', 'parents', 'disabledDependents', 'maternity'] },
  {
    key: 'insurance',
    fields: ['socialSecurity', 'lifeInsurance', 'healthInsurance', 'parentHealthInsurance', 'pensionInsurance', 'pvd', 'gpf', 'nsf', 'rmf', 'ssf', 'thaiEsg'],
  },
  { key: 'other', fields: ['homeLoanInterest', 'easyEReceipt', 'donation', 'donationDouble'] },
];

export function toFormValues(input: TaxInput): TaxFormValues {
  const out: Record<string, string | boolean> = {};
  for (const [k, v] of Object.entries(input)) out[k] = typeof v === 'boolean' ? v : String(v);
  return out as TaxFormValues;
}

/** Blank or unreadable numbers become 0; commas and spaces are stripped. Fractions pass through for the server to reject. */
export function toTaxInput(values: TaxFormValues): TaxInput {
  const out: Record<string, number | boolean> = {};
  for (const k of Object.keys(EMPTY_TAX_INPUT)) {
    const v = values[k as keyof TaxInput];
    if (typeof v === 'boolean') out[k] = v;
    else {
      const n = Number(v.replace(/[,\s]/g, ''));
      out[k] = v.trim() === '' || !Number.isFinite(n) ? 0 : n;
    }
  }
  return out as unknown as TaxInput;
}
