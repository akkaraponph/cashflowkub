// Forward projection of a debt from today's balance, and bilingual month labels.
import { interestForMonth, remainingPrincipal, scheduledInstallment, type DebtTerms } from './terms';

export const MAX_MONTHS = 600;

export interface ScheduleRow {
  month: number;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
}

export function projectSchedule(d: DebtTerms): { rows: ScheduleRow[]; totalInterest: number; neverPaysOff: boolean } {
  let balance = remainingPrincipal(d);
  const installment = scheduledInstallment(d);
  const rows: ScheduleRow[] = [];
  let totalInterest = 0;
  if (balance > 0 && installment <= 0) return { rows, totalInterest, neverPaysOff: true };
  for (let month = 1; balance > 0; month++) {
    const interest = interestForMonth(d, balance);
    const principal = Math.min(installment - interest, balance);
    if (principal <= 0 || month > MAX_MONTHS) return { rows: [], totalInterest: 0, neverPaysOff: true };
    balance -= principal;
    totalInterest += interest;
    rows.push({ month, payment: principal + interest, principal, interest, balance });
  }
  return { rows, totalInterest, neverPaysOff: false };
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
