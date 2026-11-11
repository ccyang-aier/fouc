import assert from 'node:assert/strict';
import { test } from 'node:test';
import { waitForReady } from './dev-readiness.mjs';

const web = { url: 'http://localhost:3000/', timeoutMs: 180_000, requestTimeoutMs: 60_000, jsonHealth: false };

test('cold compilation longer than the previous 45-second budget can become ready', async () => {
  let elapsed = 0;
  let attempts = 0;
  const ready = await waitForReady(web, {
    now: () => elapsed,
    sleep: async (ms) => { elapsed += ms; },
    fetchResponse: async () => {
      attempts += 1;
      if (attempts === 1) { elapsed += 60_000; throw new Error('request timeout'); }
      elapsed += 15_000;
      return new Response('<html>compiled</html>', { status: 200 });
    },
  });
  assert.equal(ready, true);
  assert.ok(elapsed > 45_000);
});

test('a backend must return exactly HTTP 200 and ok:true', async () => {
  let elapsed = 0;
  const responses = [
    new Response('{"ok":true}', { status: 201 }),
    new Response('{"ok":false}', { status: 200 }),
    new Response('not ready', { status: 503 }),
    new Response('{"ok":true}', { status: 200 }),
  ];
  assert.equal(await waitForReady({ ...web, jsonHealth: true }, {
    now: () => elapsed,
    sleep: async (ms) => { elapsed += ms; },
    fetchResponse: async () => responses.shift(),
  }), true);
  assert.equal(responses.length, 0);
});

test('permanent failure has a bounded deadline and a dead child stops waiting', async () => {
  let elapsed = 0;
  const options = {
    now: () => elapsed,
    sleep: async (ms) => { elapsed += ms; },
    fetchResponse: async () => { throw new Error('unreachable'); },
  };
  assert.equal(await waitForReady({ ...web, timeoutMs: 1000 }, options), false);
  assert.equal(elapsed, 1000);
  options.fetchResponse = async () => { assert.fail('must not probe a dead child'); };
  assert.equal(await waitForReady(web, { ...options, child: { exitCode: 1 } }), false);
});

test('a pending Web request does not block backend readiness checks', async () => {
  let finishCompilation;
  const compilation = new Promise((resolve) => { finishCompilation = resolve; });
  const waitingWeb = waitForReady(web, { fetchResponse: () => compilation });
  const backend = await waitForReady({ ...web, jsonHealth: true }, {
    fetchResponse: async () => new Response('{"ok":true}'),
  });
  assert.equal(backend, true);
  finishCompilation(new Response('compiled'));
  assert.equal(await waitingWeb, true);
});
