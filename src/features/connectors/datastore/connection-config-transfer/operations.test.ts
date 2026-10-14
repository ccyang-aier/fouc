import { expect, test } from 'bun:test';
import { defaultConnectionOptions } from '@fouc/shared/connection-options';
import {
  createConnectionConfigBundle,
  type TransferConnection,
} from '@fouc/shared/connection-config-transfer';
import { runConnectionImport } from './operations';

const entry = (name: string): TransferConnection => ({
  name,
  config: {
    provider: 'mysql',
    host: 'localhost',
    port: 3306,
    username: 'dev',
    database: '',
    connectionOptions: defaultConnectionOptions('mysql'),
  },
});

test('a malformed final record or new preview conflict causes zero writes', async () => {
  const bundle = createConnectionConfigBundle([entry('First'), entry('Last')]);
  let writes = 0;
  const port = {
    list: async () => [],
    save: async () => {
      writes++;
    },
  };
  const malformed = {
    ...bundle,
    connections: [
      entry('First'),
      { ...entry('Last'), config: { ...entry('Last').config, port: 0 } },
    ],
  };
  await expect(
    runConnectionImport({
      bundle: malformed,
      choices: [
        { mode: 'create', name: 'First' },
        { mode: 'create', name: 'Last' },
      ],
      port,
    }),
  ).rejects.toThrow('第 2');
  expect(writes).toBe(0);
  await expect(
    runConnectionImport({
      bundle,
      choices: [
        { mode: 'create', name: 'First' },
        { mode: 'create', name: 'Last' },
      ],
      port: {
        ...port,
        list: async () => [
          {
            ...entry('First'),
            id: 'newly-added',
            updatedAt: 1,
          },
        ],
      },
    }),
  ).rejects.toThrow('冲突');
  expect(writes).toBe(0);
});

test('partial failures remain visible and later records continue independently', async () => {
  const bundle = createConnectionConfigBundle([entry('First'), entry('Fails'), entry('Last')]);
  const calls: string[] = [];
  const outcomes = await runConnectionImport({
    bundle,
    choices: bundle.connections.map((entry) => ({
      mode: 'create',
      name: entry.name,
    })),
    port: {
      list: async () => [],
      save: async (entry) => {
        calls.push(entry.name);
        if (entry.name === 'Fails') throw new Error('Disk unavailable');
      },
    },
  });
  expect(calls).toEqual(['First', 'Fails', 'Last']);
  expect(outcomes.map((outcome) => outcome.status)).toEqual(['saved', 'failed', 'saved']);
  expect(outcomes[1].error).toBe('Disk unavailable');
});

test('cancel reports a finished in-flight save and prevents every subsequent mutation', async () => {
  const bundle = createConnectionConfigBundle([entry('First'), entry('Last')]),
    controller = new AbortController();
  const calls: string[] = [];
  const outcomes = await runConnectionImport({
    bundle,
    choices: [
      { mode: 'create', name: 'First' },
      { mode: 'create', name: 'Last' },
    ],
    signal: controller.signal,
    port: {
      list: async () => [],
      save: async (entry) => {
        calls.push(entry.name);
        controller.abort();
      },
    },
  });
  expect(calls).toEqual(['First']);
  expect(outcomes.map((outcome) => outcome.status)).toEqual(['saved', 'cancelled']);
});
