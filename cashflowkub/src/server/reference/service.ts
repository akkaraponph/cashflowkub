// Generic CRUD over the reference resources.
import type { z } from 'zod';
import { prisma } from '@/lib/db';
import { notFound } from '@/server/errors';
import { assertAccountNameFree, assertAccountUnused, renameAccountInTransactions } from './accounts';
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

export async function createResource<K extends ResourceName>(name: K, body: unknown): Promise<ResourceRows[K]> {
  const data = parseBody(schemaOf(name), body);
  if (name === 'accounts') {
    return prisma.$transaction(async (tx) => {
      await assertAccountNameFree(tx, String(data.name));
      return tx.account.create({ data: data as never }) as Promise<ResourceRows[K]>;
    });
  }
  return delegate(name).create({ data });
}

export async function updateResource<K extends ResourceName>(name: K, id: number, body: unknown): Promise<ResourceRows[K]> {
  const data = parseBody(schemaOf(name).partial(), body);
  if (name === 'accounts') {
    return prisma.$transaction(async (tx) => {
      const current = await tx.account.findUnique({ where: { id } });
      if (!current) throw notFound();
      if (typeof data.name === 'string' && data.name !== current.name) {
        await assertAccountNameFree(tx, data.name, id);
        await renameAccountInTransactions(tx, current.name, data.name);
      }
      return tx.account.update({ where: { id }, data: data as never }) as Promise<ResourceRows[K]>;
    });
  }
  return delegate(name).update({ where: { id }, data });
}

export async function deleteResource(name: ResourceName, id: number): Promise<void> {
  if (name === 'accounts') {
    await prisma.$transaction(async (tx) => {
      const current = await tx.account.findUnique({ where: { id } });
      if (!current) throw notFound();
      await assertAccountUnused(tx, current.name);
      await tx.account.delete({ where: { id } });
    });
    return;
  }
  await delegate(name).delete({ where: { id } });
}
