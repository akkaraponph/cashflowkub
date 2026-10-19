// Generic CRUD over the reference resources.
import type { z } from 'zod';
import { prisma, type DbTx } from '@/lib/db';
import { notFound } from '@/server/errors';
import { assertAccountNameFree, assertAccountUnused, renameAccountInTransactions } from './accounts';
import { assertChannelNameFree, assertChannelUnused, renameChannelInTransactions } from './channels';
import { assertGoalNameFree, assertGoalUnused, renameGoalInTransactions } from './goals';
import { assertIncomeNameFree, assertIncomeUnused, renameIncomeInTransactions } from './income';
import { parseBody } from '@/server/validate';
import { RESOURCE_SCHEMAS, type ResourceName, type ResourceRows } from './resources';

interface Delegate<Row> {
  findMany(args: { orderBy: { sort: 'asc' } }): Promise<Row[]>;
  findUnique(args: { where: { id: number } }): Promise<Row | null>;
  create(args: { data: object }): Promise<Row>;
  update(args: { where: { id: number }; data: object }): Promise<Row>;
  delete(args: { where: { id: number } }): Promise<Row>;
}

// Each Prisma model delegate has its own generic signatures. They all satisfy this
// narrow shape at runtime, so we widen them once here instead of at every call site.
function delegate<K extends ResourceName>(name: K): Delegate<ResourceRows[K]> {
  const delegates = {
    accounts: prisma.account,
    categories: prisma.category,
    budgets: prisma.budget,
    goals: prisma.goal,
    assets: prisma.asset,
    channels: prisma.channel,
    'income-categories': prisma.incomeCategory,
  };
  return delegates[name] as unknown as Delegate<ResourceRows[K]>;
}

// The per-resource schemas are a union keyed by name; the generic K cannot select one, so widen to a plain object schema.
function schemaOf(name: ResourceName): z.ZodObject {
  return RESOURCE_SCHEMAS[name] as z.ZodObject;
}

export function listResource<K extends ResourceName>(name: K): Promise<ResourceRows[K][]> {
  return delegate(name).findMany({ orderBy: { sort: 'asc' } });
}

export async function getResource<K extends ResourceName>(name: K, id: number): Promise<ResourceRows[K]> {
  const row = await delegate(name).findUnique({ where: { id } });
  if (!row) throw notFound();
  return row;
}

type Tx = DbTx;

/** Resources whose NAME is stored on transactions: unique, renamed in place, and undeletable while in use. */
interface NameRef {
  model: 'account' | 'goal' | 'channel' | 'incomeCategory';
  free(tx: Tx, name: string, exceptId?: number): Promise<void>;
  rename(tx: Tx, from: string, to: string): Promise<void>;
  unused(tx: Tx, name: string): Promise<void>;
}

const NAME_REFS: Partial<Record<ResourceName, NameRef>> = {
  accounts: { model: 'account', free: assertAccountNameFree, rename: renameAccountInTransactions, unused: assertAccountUnused },
  goals: { model: 'goal', free: assertGoalNameFree, rename: renameGoalInTransactions, unused: assertGoalUnused },
  channels: { model: 'channel', free: assertChannelNameFree, rename: renameChannelInTransactions, unused: assertChannelUnused },
  'income-categories': { model: 'incomeCategory', free: assertIncomeNameFree, rename: renameIncomeInTransactions, unused: assertIncomeUnused },
};

const txDelegate = (tx: Tx, ref: NameRef) => tx[ref.model] as unknown as Omit<Delegate<{ name: string }>, 'findMany'>;

export async function createResource<K extends ResourceName>(name: K, body: unknown): Promise<ResourceRows[K]> {
  const data = parseBody(schemaOf(name), body);
  const ref = NAME_REFS[name];
  if (!ref) return delegate(name).create({ data });
  return prisma.$transaction(async (tx) => {
    await ref.free(tx, String(data.name));
    return (await txDelegate(tx, ref).create({ data })) as ResourceRows[K];
  });
}

export async function updateResource<K extends ResourceName>(name: K, id: number, body: unknown): Promise<ResourceRows[K]> {
  const data = parseBody(schemaOf(name).partial(), body);
  const ref = NAME_REFS[name];
  if (!ref) return delegate(name).update({ where: { id }, data });
  return prisma.$transaction(async (tx) => {
    const current = await txDelegate(tx, ref).findUnique({ where: { id } });
    if (!current) throw notFound();
    if (typeof data.name === 'string' && data.name !== current.name) {
      await ref.free(tx, data.name, id);
      await ref.rename(tx, current.name, data.name);
    }
    return (await txDelegate(tx, ref).update({ where: { id }, data })) as ResourceRows[K];
  });
}

export async function deleteResource(name: ResourceName, id: number): Promise<void> {
  const ref = NAME_REFS[name];
  if (!ref) {
    await delegate(name).delete({ where: { id } });
    return;
  }
  await prisma.$transaction(async (tx) => {
    const current = await txDelegate(tx, ref).findUnique({ where: { id } });
    if (!current) throw notFound();
    await ref.unused(tx, current.name);
    await txDelegate(tx, ref).delete({ where: { id } });
  });
}
