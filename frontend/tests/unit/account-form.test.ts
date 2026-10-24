import { describe, expect, it } from 'vitest';
import { accountBody, emptyAccountForm, formFromAccount } from '@/app/(app)/accounts/account-form';

const account = { id: 5, name: 'KTC Credit', sub: '••7733', balance: -18200, icon: 'credit-card', tint: 'pdf', kind: 'credit', startDate: '', startTh: '', sort: 5 };

describe('account form', () => {
  it('rejects a blank name', () => {
    expect(accountBody({ ...emptyAccountForm, name: '   ' })).toBeNull();
  });
  it('add mode sends trimmed values plus the kind preset icon and tint', () => {
    expect(accountBody({ name: ' Savings ', sub: ' KBank ', kind: 'bank', balance: '1,250' })).toEqual({
      name: 'Savings', sub: 'KBank', kind: 'bank', balance: 1250, icon: 'landmark', tint: 'doc',
    });
  });
  it('keeps a negative balance (credit owed) and rounds', () => {
    expect(accountBody({ ...emptyAccountForm, name: 'Card', kind: 'credit', balance: '-18200.6' })?.balance).toBe(-18201);
  });
  it('treats a blank or invalid balance as 0', () => {
    expect(accountBody({ ...emptyAccountForm, name: 'X', balance: '' })?.balance).toBe(0);
    expect(accountBody({ ...emptyAccountForm, name: 'X', balance: 'abc' })?.balance).toBe(0);
  });
  it('edit mode round-trips and keeps the stored icon when the kind is unchanged', () => {
    const f = formFromAccount(account);
    expect(f).toEqual({ name: 'KTC Credit', sub: '••7733', kind: 'credit', balance: '-18200' });
    expect(accountBody(f, 'credit')).toEqual({ name: 'KTC Credit', sub: '••7733', kind: 'credit', balance: -18200 });
  });
  it('edit mode sends the new preset icon when the kind changes', () => {
    expect(accountBody({ ...formFromAccount(account), kind: 'cash' }, 'credit')).toMatchObject({ kind: 'cash', icon: 'banknote', tint: 'folder' });
  });
  it('falls back to bank for an unknown stored kind', () => {
    expect(formFromAccount({ ...account, kind: 'weird' }).kind).toBe('bank');
  });
});
