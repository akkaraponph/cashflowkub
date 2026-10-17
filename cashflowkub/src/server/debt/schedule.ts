// Forward projection of a debt from today's balance, and bilingual month labels.
import { interestForMonth, monthlyRate, remainingPrincipal, scheduledInstallment, type DebtTerms } from './terms';

export const MAX_MONTHS = 600;

export interface ScheduleRow {
  month: number;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
}

/** `overrides` maps a 1-based month to the payment made that month instead of the regular instalment. */
export function projectSchedule(d: DebtTerms, overrides: Readonly<Record<number, number>> = {}): { rows: ScheduleRow[]; totalInterest: number; neverPaysOff: boolean } {
  let balance = remainingPrincipal(d);
  const installment = scheduledInstallment(d);
  const rows: ScheduleRow[] = [];
  let totalInterest = 0;
  if (balance > 0 && installment <= 0) return { rows, totalInterest, neverPaysOff: true };
  for (let month = 1; balance > 0; month++) {
    const interest = interestForMonth(d, balance);
    const pay = overrides[month];
    const principal = Math.min((pay ?? installment) - interest, balance);
    if ((principal <= 0 && pay === undefined) || month > MAX_MONTHS) return { rows: [], totalInterest: 0, neverPaysOff: true };
    balance -= principal;
    totalInterest += interest;
    rows.push({ month, payment: principal + interest, principal, interest, balance });
  }
  return { rows, totalInterest, neverPaysOff: false };
}

/** Smallest whole-baht monthly payment that clears the debt in at most `months` months. */
export function paymentForTarget(d: DebtTerms, months: number): number {
  if (!Number.isInteger(months) || months < 1) throw new RangeError(`months must be a positive integer: ${months}`);
  const balance = remainingPrincipal(d);
  if (balance === 0) return 0;
  const r = monthlyRate(d);
  let p: number;
  if (d.calc !== 'reducing') p = Math.ceil(balance / months) + interestForMonth(d, balance);
  else if (r === 0) p = Math.ceil(balance / months);
  else p = Math.ceil((balance * r) / (1 - (1 + r) ** -months));
  for (let i = 0; i < 5 && projectSchedule({ ...d, fixedPayment: p }).rows.length > months; i++) p += 1;
  return p;
}

const EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

/** "Apr 2030" / "เม.ย. 2030": the month `months` after today's month. */
export function payoffLabel(today: Date, months: number): { en: string; th: string } {
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + months, 1));
  const m = d.getUTCMonth();
  const y = d.getUTCFullYear();
  return { en: `${EN[m]} ${y}`, th: `${TH[m]} ${y}` };
}
