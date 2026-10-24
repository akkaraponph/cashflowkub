import { describe, expect, it } from 'vitest';
import { emptyGoalForm, formFromGoal, goalBody } from '@/app/(app)/goals/goal-form';

const goal = { id: 2, name: 'Japan Trip', th: 'เที่ยวญี่ปุ่น', icon: 'plane', saved: 64000, target: 120000, monthly: 6000, by: 'Dec 2026', sort: 2 };

describe('goal form', () => {
  it('rejects a blank name', () => expect(goalBody({ ...emptyGoalForm, name: ' ', target: '100' })).toBeNull());
  it('rejects a blank or zero target', () => {
    expect(goalBody({ ...emptyGoalForm, name: 'X' })).toBeNull();
    expect(goalBody({ ...emptyGoalForm, name: 'X', target: '0' })).toBeNull();
  });
  it('rejects a negative saved or monthly', () => {
    expect(goalBody({ ...emptyGoalForm, name: 'X', target: '10', saved: '-1' })).toBeNull();
    expect(goalBody({ ...emptyGoalForm, name: 'X', target: '10', monthly: '-1' })).toBeNull();
  });
  it('parses commas and baht signs; blank saved and monthly are 0', () => {
    expect(goalBody({ name: ' Car ', icon: 'car', target: '฿300,000', saved: '', monthly: '', by: ' 2028 ' })).toEqual({
      name: 'Car', th: 'Car', icon: 'car', target: 300000, saved: 0, monthly: 0, by: '2028',
    });
  });
  it('allows saved above target', () => {
    expect(goalBody({ ...emptyGoalForm, name: 'X', target: '100', saved: '150' })?.saved).toBe(150);
  });
  it('edit mode shows the name in the current language', () => {
    expect(formFromGoal(goal, 'th')).toEqual({ name: 'เที่ยวญี่ปุ่น', icon: 'plane', target: '120000', saved: '64000', monthly: '6000', by: 'Dec 2026' });
  });
  it('edit mode leaves the name alone when it was not changed', () => {
    const f = formFromGoal(goal, 'th');
    const body = goalBody({ ...f, target: '150000' }, f);
    expect(body).not.toHaveProperty('name');
    expect(body).not.toHaveProperty('th');
    expect(body).toMatchObject({ target: 150000 });
  });
  it('edit mode sends one name for both languages when it changed', () => {
    const f = formFromGoal(goal, 'en');
    expect(goalBody({ ...f, name: 'Tokyo' }, f)).toMatchObject({ name: 'Tokyo', th: 'Tokyo' });
  });
});
