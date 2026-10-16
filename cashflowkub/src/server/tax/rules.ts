// Thai personal income tax rules, per tax year. Only 2025 (B.E. 2568) is pinned; other years reuse it and say so.

export interface TaxBracket {
  upTo: number;
  rate: number;
}

export interface TaxRules {
  brackets: TaxBracket[];
  expenseRate: number;
  expenseMax: number;
  personal: number;
  spouse: number;
  child: number;
  child2018Extra: number;
  parent: number;
  parentsMax: number;
  disabled: number;
  maternityMax: number;
  socialSecurityMax: number;
  lifeMax: number;
  healthMax: number;
  lifeHealthMax: number;
  parentHealthMax: number;
  pensionRate: number;
  pensionMax: number;
  pvdRate: number;
  pvdMax: number;
  gpfRate: number;
  gpfMax: number;
  nsfMax: number;
  rmfRate: number;
  rmfMax: number;
  ssfRate: number;
  ssfMax: number;
  retirementGroupMax: number;
  thaiEsgRate: number;
  thaiEsgMax: number;
  homeLoanMax: number;
  easyEReceiptMax: number;
  donationCapRate: number;
}

export const RULES_YEAR = 2025;

export const TAX_RULES_2025: TaxRules = {
  brackets: [
    { upTo: 150_000, rate: 0 },
    { upTo: 300_000, rate: 0.05 },
    { upTo: 500_000, rate: 0.1 },
    { upTo: 750_000, rate: 0.15 },
    { upTo: 1_000_000, rate: 0.2 },
    { upTo: 2_000_000, rate: 0.25 },
    { upTo: 5_000_000, rate: 0.3 },
    { upTo: Infinity, rate: 0.35 },
  ],
  expenseRate: 0.5,
  expenseMax: 100_000,
  personal: 60_000,
  spouse: 60_000,
  child: 30_000,
  child2018Extra: 30_000,
  parent: 30_000,
  parentsMax: 4,
  disabled: 60_000,
  maternityMax: 60_000,
  socialSecurityMax: 9_000,
  lifeMax: 100_000,
  healthMax: 25_000,
  lifeHealthMax: 100_000,
  parentHealthMax: 15_000,
  pensionRate: 0.15,
  pensionMax: 200_000,
  pvdRate: 0.15,
  pvdMax: 500_000,
  gpfRate: 0.15,
  gpfMax: 500_000,
  nsfMax: 30_000,
  rmfRate: 0.3,
  rmfMax: 500_000,
  ssfRate: 0.3,
  ssfMax: 200_000,
  retirementGroupMax: 500_000,
  thaiEsgRate: 0.3,
  thaiEsgMax: 300_000,
  homeLoanMax: 100_000,
  easyEReceiptMax: 50_000,
  donationCapRate: 0.1,
};

/** Rules for a year. Unpinned years reuse 2025 without Easy E-Receipt and are flagged `assumed`. */
export function rulesFor(year: number): { rules: TaxRules; rulesYear: number; assumed: boolean } {
  if (year === RULES_YEAR) return { rules: TAX_RULES_2025, rulesYear: RULES_YEAR, assumed: false };
  return { rules: { ...TAX_RULES_2025, easyEReceiptMax: 0 }, rulesYear: RULES_YEAR, assumed: true };
}
