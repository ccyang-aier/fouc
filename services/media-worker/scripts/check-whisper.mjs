// Real S3 -> HTTP -> isolated faster-whisper acceptance. No model API keys.
import assert from 'node:assert/strict';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { createMediaWorkerClient, MediaWorkerError } from '../.runtime/client.mjs';

function environment(url) {
  return Object.fromEntries(readFileSync(url, 'utf8').split(/\r?\n/).filter((line) => line && !line.startsWith('#')).map((line) => {
    const separator = line.indexOf('=');
    return [line.slice(0, separator), line.slice(separator + 1)];
  }));
}
const worker = environment(new URL('../.env.local', import.meta.url));
const storage = environment(new URL('../../../.env.knowledge.local', import.meta.url));
const hash = (value) => createHash('sha256').update(value).digest('hex');
const hmac = (key, value) => createHmac('sha256', key).update(value).digest();
const encode = (value) => encodeURIComponent(value).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
const signingKey = (day) => hmac(hmac(hmac(hmac(`AWS4${storage.S3_SECRET_ACCESS_KEY}`, day), storage.S3_REGION), 's3'), 'aws4_request');

function presignedGet(path) {
  const issued = new Date(Math.floor(Date.now() / 1000) * 1000);
  const date = issued.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const day = date.slice(0, 8);
  const scope = `${day}/${storage.S3_REGION}/s3/aws4_request`;
  const url = new URL(path, storage.S3_ENDPOINT);
  const values = { 'X-Amz-Algorithm': 'AWS4-HMAC-SHA256', 'X-Amz-Credential': `${storage.S3_ACCESS_KEY_ID}/${scope}`,
    'X-Amz-Date': date, 'X-Amz-Expires': '300', 'X-Amz-SignedHeaders': 'host' };
  const query = Object.entries(values).sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => `${encode(key)}=${encode(value)}`).join('&');
  const canonical = ['GET', url.pathname, query, `host:${url.host}\n`, 'host', 'UNSIGNED-PAYLOAD'].join('\n');
  const signature = createHmac('sha256', signingKey(day)).update(`AWS4-HMAC-SHA256\n${date}\n${scope}\n${hash(canonical)}`).digest('hex');
  url.search = `${query}&X-Amz-Signature=${signature}`;
  return { url: url.href, expiresAt: new Date(issued.getTime() + 300_000).toISOString() };
}

async function objectRequest(method, path, body = Buffer.alloc(0)) {
  const url = new URL(path, storage.S3_ENDPOINT);
  const date = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const day = date.slice(0, 8);
  const scope = `${day}/${storage.S3_REGION}/s3/aws4_request`;
  const payloadHash = hash(body);
  const headers = { host: url.host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': date };
  const names = Object.keys(headers).join(';');
  const canonical = [method, url.pathname, '', Object.entries(headers).map(([key, value]) => `${key}:${value}\n`).join(''), names, payloadHash].join('\n');
  const signature = createHmac('sha256', signingKey(day)).update(`AWS4-HMAC-SHA256\n${date}\n${scope}\n${hash(canonical)}`).digest('hex');
  const response = await fetch(url, { method, body, signal: AbortSignal.timeout(10_000), headers: {
    ...headers, authorization: `AWS4-HMAC-SHA256 Credential=${storage.S3_ACCESS_KEY_ID}/${scope}, SignedHeaders=${names}, Signature=${signature}`,
  } });
  await response.body?.cancel();
  assert.ok(response.ok, `S3 ${method} failed with HTTP ${response.status}.`);
}

const client = createMediaWorkerClient({ baseUrl: `http://127.0.0.1:${worker.MEDIA_WORKER_PORT}`, token: worker.MEDIA_WORKER_TOKEN });
const prefix = `/${storage.S3_BUCKET}/w02-verification/${randomUUID()}`;
const uploaded = [];
const evidence = { date: new Date().toISOString(), capabilities: await client.capabilities(), results: [], failures: [] };
assert.ok(evidence.capabilities.operations.includes('transcribe'), 'Restart the prepared worker before real Whisper acceptance.');

function assertSpeech(result) {
  const segments = result.derived.transcript;
  assert.ok(segments?.length, 'Real speech produced no transcript.');
  const text = segments.map((segment) => segment.text).join(' ').toLowerCase();
  assert.ok(text.includes('my fellow americans') && text.includes('your country') && text.includes('do for you'), 'Recognized real speech did not match the official source.');
  for (const segment of segments) assert.ok(segment.start >= 0 && segment.end >= segment.start && segment.end <= 11.05);
}

try {
  let audioRequest;
  for (const [filename, mime] of [['jfk.flac', 'audio/flac'], ['jfk-video.mp4', 'video/mp4']]) {
    const bytes = readFileSync(new URL(`../.cache/samples/${filename}`, import.meta.url));
    const path = `${prefix}/${filename}`;
    await objectRequest('PUT', path, bytes);
    uploaded.push(path);
    const request = { requestId: randomUUID(), operation: 'transcribe', language: 'en', timeoutMs: 60_000,
      resource: { ...presignedGet(path), sha256: hash(bytes), size: bytes.length, mime } };
    const result = await client.process(request);
    assertSpeech(result);
    evidence.results.push({ fixture: filename, ...result });
    console.log(`PASS real ${mime}: ${result.derived.transcript.length} timestamp segment(s), ${result.elapsedMs} ms, ${result.processor}.`);
    if (mime === 'audio/flac') audioRequest = request;
  }

  const badPath = `${prefix}/invalid.flac`;
  const invalid = Buffer.from('W02 deliberately corrupt media; not a recognition fixture.');
  await objectRequest('PUT', badPath, invalid);
  uploaded.push(badPath);
  await assert.rejects(client.process({ ...audioRequest, requestId: randomUUID(), resource: {
    ...presignedGet(badPath), mime: 'audio/flac', size: invalid.length, sha256: hash(invalid),
  } }), (error) => {
    assert.ok(error instanceof MediaWorkerError && error.code === 'invalid_media' && error.status === 422 && !error.retryable);
    evidence.failures.push({ case: 'corrupt media', code: error.code, status: error.status, retryable: error.retryable });
    return true;
  });

  await assert.rejects(client.process({ ...audioRequest, requestId: randomUUID(), timeoutMs: 1 }), (error) => {
    assert.ok(error instanceof MediaWorkerError && error.code === 'task_timeout' && error.status === 504 && error.retryable);
    evidence.failures.push({ case: 'overall HTTP task deadline (not asserted to be inference-stage)', code: error.code, status: error.status, retryable: error.retryable });
    return true;
  });
  await assert.rejects(client.process({ ...audioRequest, requestId: randomUUID(), language: 'zz' }), (error) => {
    assert.ok(error instanceof MediaWorkerError && error.code === 'unsupported_language' && error.status === 422 && !error.retryable);
    evidence.failures.push({ case: 'unsupported language', code: error.code, status: error.status, retryable: error.retryable });
    return true;
  });
  const retried = await client.process({ ...audioRequest, requestId: randomUUID() });
  assertSpeech(retried);
  evidence.results.push({ fixture: 'same real audio, new attempt after timeout', ...retried });
  const cancellation = new AbortController();
  const cancelTimer = setTimeout(() => cancellation.abort(), 200);
  try {
    await assert.rejects(client.process({ ...audioRequest, requestId: randomUUID() }, cancellation.signal),
      (error) => error instanceof MediaWorkerError && error.code === 'task_cancelled' && !error.retryable);
    evidence.failures.push({ case: 'caller abort with explicit server cancellation', code: 'task_cancelled', retryable: false });
  } finally { clearTimeout(cancelTimer); }
  console.log('PASS real HTTP failure/deadline/retry/cancellation protocol.');
} finally {
  for (const path of uploaded) await objectRequest('DELETE', path);
  console.log(`Removed ${uploaded.length} test-only S3 objects; local source fixtures remain cached.`);
}
writeFileSync(new URL('../.runtime/whisper-verification.json', import.meta.url), JSON.stringify(evidence, null, 2) + '\n');
console.log('Saved credential-free .runtime/whisper-verification.json.');
