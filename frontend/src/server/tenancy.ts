// Pure query-scoping rules; no Prisma imports so they stay unit-testable.
export const OWNED_MODELS: ReadonlySet<string> = new Set([
  'Account', 'Category', 'Transaction', 'Budget', 'Goal', 'Debt', 'DebtPayment', 'Setting', 'Asset', 'Bill',
  'BillPayment', 'Channel', 'IncomeCategory', 'PlanItem', 'AssetSnapshot', 'NetWorthHistory', 'MonthlyCashflow',
  'DaySpend', 'SetupGoal', 'SetupGoalChannel',
]);

export const COMPOSITE_KEYS: Record<string, string> = { Category: 'key', Setting: 'key' };

type Args = Record<string, unknown>;

function ownRow(row: unknown, userId: string): Args {
  const r = (row ?? {}) as Args;
  if (r.userId !== undefined && r.userId !== userId) throw new Error('userId mismatch');
  return { ...r, userId };
}

function scopeWhere(where: unknown, userId: string): Args {
  return ownRow(where, userId);
}

function scopeUniqueWhere(model: string, where: unknown, userId: string): Args {
  const keyField = COMPOSITE_KEYS[model];
  const w = ownRow(where, userId);
  if (!keyField) return w;
  const compound = `userId_${keyField}`;
  const given = w[compound] as Args | undefined;
  if (given !== undefined) {
    if (given.userId !== userId) throw new Error('userId mismatch');
    return w;
  }
  // `key` alone is no longer unique: rewrite it (with or without a matching userId) to the compound key.
  if (w[keyField] === undefined) return w;
  const { [keyField]: keyValue, ...rest } = w;
  delete rest.userId;
  return { ...rest, [compound]: { userId, [keyField]: keyValue } };
}

/** Write data may not move a row to another user, by scalar or by relation. */
function guardData<T>(data: T, userId: string): T {
  const d = (data ?? {}) as Args;
  if (d.userId !== undefined && d.userId !== userId) throw new Error('userId mismatch');
  if (d.user !== undefined) throw new Error('user relation writes are not allowed');
  return data;
}

export function scopeArgs(model: string, operation: string, args: Args, userId: string): Args {
  if (!OWNED_MODELS.has(model)) return args;
  switch (operation) {
    case 'updateMany':
    case 'updateManyAndReturn':
      return { ...args, where: scopeWhere(args.where, userId), data: guardData(args.data, userId) };
    case 'findMany':
    case 'findFirst':
    case 'findFirstOrThrow':
    case 'deleteMany':
    case 'count':
    case 'aggregate':
    case 'groupBy':
      return { ...args, where: scopeWhere(args.where, userId) };
    case 'findUnique':
    case 'findUniqueOrThrow':
    case 'delete':
      return { ...args, where: scopeUniqueWhere(model, args.where, userId) };
    case 'update':
      return { ...args, where: scopeUniqueWhere(model, args.where, userId), data: guardData(args.data, userId) };
    case 'upsert':
      return {
        ...args,
        where: scopeUniqueWhere(model, args.where, userId),
        create: ownRow(guardData(args.create, userId), userId),
        update: guardData(args.update, userId),
      };
    case 'create':
      return { ...args, data: ownRow(guardData(args.data, userId), userId) };
    case 'createMany':
    case 'createManyAndReturn': {
      const rows = Array.isArray(args.data) ? args.data : [args.data];
      return { ...args, data: rows.map((row) => ownRow(guardData(row, userId), userId)) };
    }
    default:
      throw new Error(`unsupported operation ${operation} on ${model}`);
  }
}
