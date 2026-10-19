import { describe, expect, it } from 'vitest';
import { currentScope, requireUserId, runAsSystem, runAsUser } from '@/lib/user-context';

describe('user context', () => {
  it('is null outside any scope', () => {
    expect(currentScope()).toBeNull();
  });
  it('runAsUser exposes the id, including after an await', async () => {
    await runAsUser('u1', async () => {
      await Promise.resolve();
      expect(currentScope()).toEqual({ kind: 'user', userId: 'u1' });
      expect(await requireUserId()).toBe('u1');
    });
  });
  it('nested runAsSystem reports system and requireUserId throws', async () => {
    await runAsUser('u1', () =>
      runAsSystem(async () => {
        expect(currentScope()).toEqual({ kind: 'system' });
        await expect(requireUserId()).rejects.toThrow('system scope has no user');
      }),
    );
  });
});
