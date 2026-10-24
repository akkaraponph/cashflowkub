// Pure rules for transaction activities (the spreadsheet planner's six kinds of row). Shared by server and client.

export const ACTIVITIES = ['receive', 'pay', 'save', 'pay_debt', 'withdraw', 'transfer'] as const;
export type Activity = (typeof ACTIVITIES)[number];

/** Which list a row's `item` names. */
export type ItemList = 'income' | 'channel' | 'debt' | 'account';

export const ACTIVITY_TH: Record<Activity, string> = {
  receive: 'รับเงิน', pay: 'จ่ายเงิน', save: 'สะสมเงิน', pay_debt: 'ชำระหนี้', withdraw: 'เบิกเงิน', transfer: 'เปลี่ยนบัญชี',
};

const ITEM_LIST: Record<Activity, ItemList | null> = {
  receive: 'income', pay: null, save: 'channel', pay_debt: 'debt', withdraw: 'channel', transfer: 'account',
};

const FIXED_CAT: Record<Activity, string | null> = {
  receive: 'income', pay: null, save: 'saving', pay_debt: 'debt', withdraw: '', transfer: '',
};

export const itemListFor = (a: Activity): ItemList | null => ITEM_LIST[a];
export const fixedCat = (a: Activity): string | null => FIXED_CAT[a];
export const itemRequired = (a: Activity): boolean => a === 'save' || a === 'pay_debt' || a === 'withdraw' || a === 'transfer';
export const isInflow = (a: Activity): boolean => a === 'receive' || a === 'withdraw' || a === 'transfer';

export function signedAmount(a: Activity, magnitude: number): number {
  return isInflow(a) ? Math.abs(magnitude) : -Math.abs(magnitude);
}

/** The activity a row had before activities existed: sign and category sub decide. */
export function legacyActivity(amount: number, catSub: string): Activity {
  if (amount > 0) return 'receive';
  if (catSub === 'saving') return 'save';
  if (catSub === 'debt') return 'pay_debt';
  return 'pay';
}

/** Reads an activity key, its Thai label, or the legacy words income / expense. Null for anything else. */
export function activityFromLabel(raw: string): Activity | null {
  const s = raw.trim().toLowerCase();
  if (s === 'income') return 'receive';
  if (s === 'expense') return 'pay';
  for (const a of ACTIVITIES) if (s === a || s === ACTIVITY_TH[a]) return a;
  return null;
}

export interface ActivityRow {
  activity: Activity;
  cat: string;
  acct: string;
  item: string;
  amount: number;
  interest: number;
  fee: number;
  goal: string;
}

export type ActivityProblem =
  | 'amountSign' | 'itemRequired' | 'itemNotAllowed' | 'catNotAllowed' | 'interestOnlyOnDebt' | 'goalOnlyOnSave' | 'transferToSelf';

const same = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * First rule a row breaks, or null. `catSub` is the `sub` of the category named by `row.cat` (undefined if there is none).
 * `requireItem: false` skips the missing-item rule, for editing legacy rows that never had an item.
 */
export function checkActivity(row: ActivityRow, catSub: string | undefined, opts: { requireItem?: boolean } = {}): ActivityProblem | null {
  const a = row.activity;
  if (isInflow(a) ? row.amount <= 0 : row.amount >= 0) return 'amountSign';
  const fixed = fixedCat(a);
  if (fixed === null ? catSub === undefined || catSub === 'saving' || catSub === 'debt' : row.cat !== fixed) return 'catNotAllowed';
  if (a === 'pay' && row.item.trim() !== '') return 'itemNotAllowed';
  if ((opts.requireItem ?? true) && itemRequired(a) && row.item.trim() === '') return 'itemRequired';
  if ((row.interest > 0 || row.fee > 0) && a !== 'pay_debt') return 'interestOnlyOnDebt';
  if (row.goal.trim() !== '' && a !== 'save') return 'goalOnlyOnSave';
  if (a === 'transfer' && same(row.item, row.acct)) return 'transferToSelf';
  return null;
}
