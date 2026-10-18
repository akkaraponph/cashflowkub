import { describe, expect, it } from 'vitest';
import {
  ACTIVITIES, activityFromLabel, checkActivity, fixedCat, isInflow, itemListFor, itemRequired, legacyActivity, signedAmount,
  type ActivityRow,
} from '@/lib/activity';

const base: ActivityRow = { activity: 'pay', cat: 'food', acct: 'SCB Current', item: '', amount: -185, interest: 0, fee: 0, goal: '' };

describe('activity tables', () => {
  it('maps each activity to its item list, fixed category, direction and item requirement', () => {
    const table = {
      receive: ['income', 'income', true, false],
      pay: [null, null, false, false],
      save: ['channel', 'saving', false, true],
      pay_debt: ['debt', 'debt', false, true],
      withdraw: ['channel', '', true, true],
      transfer: ['account', '', true, true],
    } as const;
    for (const a of ACTIVITIES) {
      const [list, cat, inflow, required] = table[a];
      expect(itemListFor(a)).toBe(list);
      expect(fixedCat(a)).toBe(a === 'pay' ? null : cat);
      expect(isInflow(a)).toBe(inflow);
      expect(itemRequired(a)).toBe(required);
    }
  });

  it('signs amounts by direction', () => {
    expect(signedAmount('pay', 100)).toBe(-100);
    expect(signedAmount('transfer', -50)).toBe(50);
    expect(signedAmount('withdraw', 7)).toBe(7);
  });

  it('infers a legacy activity from sign and category sub', () => {
    expect(legacyActivity(62000, '')).toBe('receive');
    expect(legacyActivity(-100, 'saving')).toBe('save');
    expect(legacyActivity(-100, 'debt')).toBe('pay_debt');
    expect(legacyActivity(-185, 'need')).toBe('pay');
  });

  it('reads keys, Thai labels and legacy words', () => {
    expect(activityFromLabel('ชำระหนี้')).toBe('pay_debt');
    expect(activityFromLabel(' เปลี่ยนบัญชี ')).toBe('transfer');
    expect(activityFromLabel('PAY_DEBT')).toBe('pay_debt');
    expect(activityFromLabel('income')).toBe('receive');
    expect(activityFromLabel('expense')).toBe('pay');
    expect(activityFromLabel('')).toBeNull();
    expect(activityFromLabel('โอน')).toBeNull();
  });
});

describe('checkActivity', () => {
  it('accepts the base row', () => expect(checkActivity(base, 'need')).toBeNull());
  it('rejects a wrong sign', () => expect(checkActivity({ ...base, amount: 185 }, 'need')).toBe('amountSign'));
  it('rejects a saving or unknown category on pay', () => {
    const r = { ...base, cat: 'saving' };
    expect(checkActivity(r, 'saving')).toBe('catNotAllowed');
    expect(checkActivity(r, undefined)).toBe('catNotAllowed');
  });
  it('requires an item for save unless told not to', () => {
    const r: ActivityRow = { ...base, activity: 'save', cat: 'saving', item: '' };
    expect(checkActivity(r, 'saving')).toBe('itemRequired');
    expect(checkActivity(r, 'saving', { requireItem: false })).toBeNull();
  });
  it('leaves the income item optional', () => {
    expect(checkActivity({ ...base, activity: 'receive', cat: 'income', amount: 100, item: '' }, '')).toBeNull();
  });
  it('rejects an item on pay', () => expect(checkActivity({ ...base, item: 'Gold savings' }, 'need')).toBe('itemNotAllowed'));
  it('rejects interest and goal outside their activities', () => {
    expect(checkActivity({ ...base, interest: 5 }, 'need')).toBe('interestOnlyOnDebt');
    expect(checkActivity({ ...base, goal: 'Japan Trip' }, 'need')).toBe('goalOnlyOnSave');
  });
  it('rejects a transfer to the same account ignoring case and spaces', () => {
    const r: ActivityRow = { ...base, activity: 'transfer', cat: '', acct: 'SCB Current', item: ' scb current ', amount: 500 };
    expect(checkActivity(r, undefined)).toBe('transferToSelf');
  });
});
