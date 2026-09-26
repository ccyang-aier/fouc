import { EventEmitter } from 'node:events';
import { describe, expect, test } from 'bun:test';
import type { Pool } from 'pg';
import { KnowledgeTransactionAbortedError, withKnowledgeTenant } from './tenant';

const workspaceId = '11223344-5566-4788-99aa-bbccddeeff00';

function connection(query: (command: string) => Promise<{ command: string }>) {
  const client = new EventEmitter() as EventEmitter & {
    query: (command: string, values?: unknown[]) => Promise<{ command: string }>;
    release: (destroy?: boolean) => void;
  };
  const commands: string[] = [];
  const parameters: (unknown[] | undefined)[] = [];
  const releases: (boolean | undefined)[] = [];
  let checkouts = 0;
  client.query = async (command, values) => {
    commands.push(command);
    parameters.push(values);
    return query(command);
  };
  client.release = (destroy) => releases.push(destroy);
  const pool = { connect: async () => { checkouts += 1; return client; } } as unknown as Pool;
  return { client, pool, commands, parameters, releases, checkouts: () => checkouts };
}

describe('request tenant transaction lifecycle', () => {
  test('validates workspace IDs before borrowing a connection', async () => {
    const testConnection = connection(async (command) => ({ command }));
    await expect(withKnowledgeTenant(testConnection.pool, "bad'; RESET ALL; --", async () => undefined)).rejects.toThrow('Invalid workspace ID');
    expect(testConnection.checkouts()).toBe(0);
  });

  test('scope is a parameterized local setting on the borrowed connection', async () => {
    const testConnection = connection(async (command) => ({ command }));
    expect(await withKnowledgeTenant(testConnection.pool, workspaceId, async () => 'committed')).toBe('committed');
    expect(testConnection.commands).toEqual(['BEGIN', "SELECT set_config('app.workspace_id', $1, true)", 'COMMIT']);
    expect(testConnection.parameters[1]).toEqual([workspaceId]);
    expect(testConnection.releases).toEqual([false]);
    expect(testConnection.client.listenerCount('error')).toBe(0);
  });

  test('destroys a connection when BEGIN fails', async () => {
    const testConnection = connection(async () => { throw new Error('begin failed'); });
    await expect(withKnowledgeTenant(testConnection.pool, workspaceId, async () => undefined)).rejects.toThrow('begin failed');
    expect(testConnection.commands).toEqual(['BEGIN']);
    expect(testConnection.releases).toEqual([true]);
  });

  test('rolls back callback failures and preserves the originating error', async () => {
    const testConnection = connection(async (command) => ({ command }));
    const original = new Error('callback failed');
    await expect(withKnowledgeTenant(testConnection.pool, workspaceId, async () => { throw original; })).rejects.toBe(original);
    expect(testConnection.commands.at(-1)).toBe('ROLLBACK');
    expect(testConnection.releases).toEqual([false]);
  });

  test('destroys a connection when rollback fails', async () => {
    const testConnection = connection(async (command) => {
      if (command === 'ROLLBACK') throw new Error('socket closed');
      return { command };
    });
    const original = new Error('callback failed');
    await expect(withKnowledgeTenant(testConnection.pool, workspaceId, async () => { throw original; })).rejects.toBe(original);
    expect(testConnection.releases).toEqual([true]);
  });

  test('does not mistake COMMIT returning ROLLBACK for success', async () => {
    const testConnection = connection(async (command) => ({ command: command === 'COMMIT' ? 'ROLLBACK' : command }));
    await expect(withKnowledgeTenant(testConnection.pool, workspaceId, async () => 'uncommitted')).rejects.toBeInstanceOf(KnowledgeTransactionAbortedError);
    expect(testConnection.releases).toEqual([false]);
  });

  test('connection errors emitted during a callback are handled and destroy the client', async () => {
    const testConnection = connection(async (command) => ({ command }));
    await expect(withKnowledgeTenant(testConnection.pool, workspaceId, async () => {
      testConnection.client.emit('error', new Error('server connection lost'));
    })).rejects.toThrow('server connection lost');
    expect(testConnection.commands.at(-1)).toBe('ROLLBACK');
    expect(testConnection.releases).toEqual([true]);
    expect(testConnection.client.listenerCount('error')).toBe(0);
  });
});
