import { describe, expect, it } from 'vitest';
import { OWNED_MODELS, scopeArgs } from '@/server/tenancy';

describe('scopeArgs', () => {
  it('findMany adds userId to where', () => {
    expect(scopeArgs('Transaction', 'findMany', { where: { activity: 'pay' } }, 'u1')).toEqual({ where: { activity: 'pay', userId: 'u1' } });
  });
  it('findMany with no where', () => {
    expect(scopeArgs('Transaction', 'findMany', {}, 'u1')).toEqual({ where: { userId: 'u1' } });
  });
  it('findUnique by id keeps the id and adds userId', () => {
    expect(scopeArgs('Transaction', 'findUnique', { where: { id: 5 } }, 'u1')).toEqual({ where: { id: 5, userId: 'u1' } });
  });
  it('findUnique on Category by key becomes the compound key', () => {
    expect(scopeArgs('Category', 'findUnique', { where: { key: 'food' } }, 'u1')).toEqual({ where: { userId_key: { userId: 'u1', key: 'food' } } });
  });
  it('upsert on Setting', () => {
    expect(scopeArgs('Setting', 'upsert', { where: { key: 'k' }, create: { key: 'k', value: '1' }, update: { value: '2' } }, 'u1')).toEqual({
      where: { userId_key: { userId: 'u1', key: 'k' } },
      create: { key: 'k', value: '1', userId: 'u1' },
      update: { value: '2' },
    });
  });
  it('create adds userId to data', () => {
    expect(scopeArgs('Goal', 'create', { data: { name: 'x' } }, 'u1')).toEqual({ data: { name: 'x', userId: 'u1' } });
  });
  it.each(['createMany', 'createManyAndReturn'])('%s maps every row', (op) => {
    expect(scopeArgs('Goal', op, { data: [{ name: 'a' }, { name: 'b' }] }, 'u1')).toEqual({ data: [{ name: 'a', userId: 'u1' }, { name: 'b', userId: 'u1' }] });
  });
  it.each(['update', 'updateMany', 'delete', 'deleteMany', 'count', 'aggregate', 'groupBy'])('%s adds userId to where', (op) => {
    expect(scopeArgs('Debt', op, { where: { id: 2 } }, 'u1')).toEqual({ where: { id: 2, userId: 'u1' } });
  });
  it('a differing userId in data or where throws', () => {
    expect(() => scopeArgs('Goal', 'create', { data: { userId: 'u2' } }, 'u1')).toThrow();
    expect(() => scopeArgs('Goal', 'findMany', { where: { userId: 'u2' } }, 'u1')).toThrow();
    expect(() => scopeArgs('Goal', 'createMany', { data: [{ userId: 'u2' }] }, 'u1')).toThrow();
  });
  it('an unowned model is returned unchanged', () => {
    const args = { where: { id: 'x' } };
    expect(scopeArgs('User', 'findUnique', args, 'u1')).toEqual(args);
  });
  it('an unknown operation on an owned model throws', () => {
    expect(() => scopeArgs('Goal', 'findRaw', {}, 'u1')).toThrow();
  });
  it('lists 20 owned models without the auth models', () => {
    expect(OWNED_MODELS.size).toBe(20);
    for (const m of ['User', 'Session', 'AuthAccount', 'Verification']) expect(OWNED_MODELS.has(m)).toBe(false);
  });
});
