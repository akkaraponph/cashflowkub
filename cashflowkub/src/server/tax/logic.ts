// Pure Thai PIT calculator: income + deductions + rules -> tax, balance against withholding, and unused room.
import type { TaxBracket, TaxRules } from './rules';

export interface TaxInput {
  salary: number;
  freelance: number;
  otherNet: number;
  withheld: number;
  spouse: boolean;
  children: number;
  children2018Extra: number;
  parents: number;
  disabledDependents: number;
  maternity: number;
  socialSecurity: number;
  lifeInsurance: number;
  healthInsurance: number;
  parentHealthInsurance: number;
  pensionInsurance: number;
  pvd: number;
  gpf: number;
  nsf: number;
  rmf: number;
  ssf: number;
  thaiEsg: number;
  homeLoanInterest: number;
  easyEReceipt: number;
  donation: number;
  donationDouble: number;
}

export type DeductionKey =
  | 'personal' | 'spouse' | 'children' | 'parents' | 'disabled' | 'maternity' | 'socialSecurity'
  | 'lifeInsurance' | 'healthInsurance' | 'parentHealthInsurance' | 'pensionInsurance' | 'pvd' | 'gpf' | 'nsf' | 'rmf'
  | 'ssf' | 'thaiEsg' | 'homeLoanInterest' | 'easyEReceipt' | 'donationDouble' | 'donation';

export interface DeductionLine {
  key: DeductionKey;
  claimed: number;
  allowed: number;
  capped: boolean;
}

export interface TaxBand {
  rate: number;
  taxable: number;
  tax: number;
}

export interface TaxResult {
  income: number;
  expense: number;
  deductions: DeductionLine[];
  totalDeductions: number;
  netIncome: number;
  bands: TaxBand[];
  tax: number;
  marginalRate: number;
  effectiveRate: number;
  withheld: number;
  /** tax - withheld: > 0 owe, < 0 refund */
  balance: number;
  room: { rmf: number; ssf: number; thaiEsg: number };
}

export const EMPTY_TAX_INPUT: TaxInput = {
  salary: 0, freelance: 0, otherNet: 0, withheld: 0, spouse: false, children: 0, children2018Extra: 0, parents: 0,
  disabledDependents: 0, maternity: 0, socialSecurity: 0, lifeInsurance: 0, healthInsurance: 0, parentHealthInsurance: 0,
  pensionInsurance: 0, pvd: 0, gpf: 0, nsf: 0, rmf: 0, ssf: 0, thaiEsg: 0, homeLoanInterest: 0, easyEReceipt: 0,
  donation: 0, donationDouble: 0,
};

export function taxOnNet(net: number, brackets: TaxBracket[]): { bands: TaxBand[]; tax: number; marginalRate: number } {
  const bands: TaxBand[] = [];
  let lower = 0;
  for (const b of brackets) {
    const taxable = Math.min(net, b.upTo) - lower;
    if (taxable > 0) bands.push({ rate: b.rate, taxable, tax: Math.round(taxable * b.rate) });
    lower = b.upTo;
    if (net <= b.upTo) break;
  }
  return { bands, tax: bands.reduce((s, b) => s + b.tax, 0), marginalRate: bands.length ? bands[bands.length - 1].rate : 0 };
}

const cap = (claimed: number, max: number): number => Math.max(0, Math.min(claimed, max));

export function computeTax(input: TaxInput, rules: TaxRules): TaxResult {
  const r = rules;
  const income = input.salary + input.freelance + input.otherNet;
  const expense = Math.min(Math.round((input.salary + input.freelance) * r.expenseRate), r.expenseMax);
  const lines = new Map<DeductionKey, { claimed: number; allowed: number }>();
  const put = (key: DeductionKey, claimed: number, allowed: number) => lines.set(key, { claimed, allowed });

  put('personal', r.personal, r.personal);
  put('spouse', input.spouse ? r.spouse : 0, input.spouse ? r.spouse : 0);
  const extra = Math.min(input.children2018Extra, Math.max(0, input.children - 1));
  const childAmt = input.children * r.child + extra * r.child2018Extra;
  put('children', childAmt, childAmt);
  put('parents', input.parents * r.parent, Math.min(input.parents, r.parentsMax) * r.parent);
  put('disabled', input.disabledDependents * r.disabled, input.disabledDependents * r.disabled);
  put('maternity', input.maternity, cap(input.maternity, r.maternityMax));
  put('socialSecurity', input.socialSecurity, cap(input.socialSecurity, r.socialSecurityMax));
  const life = cap(input.lifeInsurance, r.lifeMax);
  put('lifeInsurance', input.lifeInsurance, life);
  put('healthInsurance', input.healthInsurance, cap(input.healthInsurance, Math.min(r.healthMax, r.lifeHealthMax - life)));
  put('parentHealthInsurance', input.parentHealthInsurance, cap(input.parentHealthInsurance, r.parentHealthMax));

  // Retirement group: each item has its own cap, then the group is trimmed from the end of this list.
  const retirementCaps: [DeductionKey, number, number][] = [
    ['pvd', input.pvd, Math.min(Math.floor(input.salary * r.pvdRate), r.pvdMax)],
    ['gpf', input.gpf, Math.min(Math.floor(input.salary * r.gpfRate), r.gpfMax)],
    ['nsf', input.nsf, r.nsfMax],
    ['pensionInsurance', input.pensionInsurance, Math.min(Math.floor(income * r.pensionRate), r.pensionMax)],
    ['rmf', input.rmf, Math.min(Math.floor(income * r.rmfRate), r.rmfMax)],
    ['ssf', input.ssf, Math.min(Math.floor(income * r.ssfRate), r.ssfMax)],
  ];
  let groupLeft = r.retirementGroupMax;
  const retirementAllowed = new Map<DeductionKey, number>();
  for (const [key, claimed, itemCap] of retirementCaps) {
    const allowed = Math.min(cap(claimed, itemCap), groupLeft);
    groupLeft -= allowed;
    retirementAllowed.set(key, allowed);
    put(key, claimed, allowed);
  }
  const rmfCap = retirementCaps.find(([k]) => k === 'rmf')![2];
  const ssfCap = retirementCaps.find(([k]) => k === 'ssf')![2];

  const esgCap = Math.min(Math.floor(income * r.thaiEsgRate), r.thaiEsgMax);
  put('thaiEsg', input.thaiEsg, cap(input.thaiEsg, esgCap));
  put('homeLoanInterest', input.homeLoanInterest, cap(input.homeLoanInterest, r.homeLoanMax));
  put('easyEReceipt', input.easyEReceipt, cap(input.easyEReceipt, r.easyEReceiptMax));

  // Donations come last: capped at a share of income left after every other deduction; double ones first.
  const beforeDonations = [...lines.values()].reduce((s, l) => s + l.allowed, 0);
  const donationCap = Math.floor(Math.max(0, income - expense - beforeDonations) * r.donationCapRate);
  const doubleAllowed = Math.min(2 * input.donationDouble, donationCap);
  put('donationDouble', 2 * input.donationDouble, doubleAllowed);
  put('donation', input.donation, cap(input.donation, donationCap - doubleAllowed));

  const order: DeductionKey[] = [
    'personal', 'spouse', 'children', 'parents', 'disabled', 'maternity', 'socialSecurity', 'lifeInsurance', 'healthInsurance',
    'parentHealthInsurance', 'pensionInsurance', 'pvd', 'gpf', 'nsf', 'rmf', 'ssf', 'thaiEsg', 'homeLoanInterest', 'easyEReceipt',
    'donationDouble', 'donation',
  ];
  const deductions: DeductionLine[] = order
    .map((key) => ({ key, claimed: lines.get(key)!.claimed, allowed: lines.get(key)!.allowed }))
    .filter((l) => l.key === 'personal' || l.claimed > 0 || l.allowed > 0)
    .map((l) => ({ ...l, capped: l.allowed < l.claimed }));
  const totalDeductions = deductions.reduce((s, l) => s + l.allowed, 0);
  const netIncome = Math.max(0, income - expense - totalDeductions);
  const { bands, tax, marginalRate } = taxOnNet(netIncome, r.brackets);

  return {
    income, expense, deductions, totalDeductions, netIncome, bands, tax, marginalRate,
    effectiveRate: income > 0 ? tax / income : 0,
    withheld: input.withheld,
    balance: tax - input.withheld,
    room: {
      rmf: Math.max(0, Math.min(rmfCap - retirementAllowed.get('rmf')!, groupLeft)),
      ssf: Math.max(0, Math.min(ssfCap - retirementAllowed.get('ssf')!, groupLeft)),
      thaiEsg: Math.max(0, esgCap - lines.get('thaiEsg')!.allowed),
    },
  };
}
