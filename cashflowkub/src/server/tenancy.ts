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
  const w = (where ?? {}) as Args;
  if (keyField && w[keyField] !== undefined && w.userId === undefined) {
    const { [keyField]: keyValue, ...rest } = w;
    return { ...rest, [`userId_${keyField}`]: { userId, [keyField]: keyValue } };
  }
  return ownRow(w, userId);
}

export function scopeArgs(model: string, operation: string, args: Args, userId: string): Args {
  if (!OWNED_MODELS.has(model)) return args;
  switch (operation) {
    case 'findMany':
    case 'findFirst':
    case 'findFirstOrThrow':
    case 'updateMany':
    case 'updateManyAndReturn':
    case 'deleteMany':
    case 'count':
    case 'aggregate':
    case 'groupBy':
      return { ...args, where: scopeWhere(args.where, userId) };
    case 'findUnique':
    case 'findUniqueOrThrow':
    case 'update':
    case 'delete':
      return { ...args, where: scopeUniqueWhere(model, args.where, userId) };
    case 'upsert':
      return {
        ...args,
        where: scopeUniqueWhere(model, args.where, userId),
        create: ownRow(args.create, userId),
      };
    case 'create':
      return { ...args, data: ownRow(args.data, userId) };
    case 'createMany':
    case 'createManyAndReturn': {
      const rows = Array.isArray(args.data) ? args.data : [args.data];
      return { ...args, data: rows.map((row) => ownRow(row, userId)) };
    }
    default:
      throw new Error(`unsupported operation ${operation} on ${model}`);
  }
}
