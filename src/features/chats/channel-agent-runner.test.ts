import { beforeAll, beforeEach, expect, mock, test } from 'bun:test';
import type { AgentEvent, AgentSession, ApprovalDto, ModelSnapshotDto } from '@fouc/shared';

const session = { id: 'device-session', installationId: 'my-installation', status: 'active' } as AgentSession;
const run = { id: 'device-run', sessionId: session.id, status: 'running' };
const calls: Array<{ path: string; init?: RequestInit }> = [];
let log: AgentEvent[];
let recorded: Array<{ id: number; event: AgentEvent }>;
let initialControls: AgentEvent[];
let availableModels: ModelSnapshotDto;
let appliedModel: string | undefined;
let execute: typeof import('./channel-agent-runner').runChannelAgent;

const event = <T extends AgentEvent>(value: T): T => value;
const delta = (text: string, sessionId = session.id, runId = run.id): AgentEvent => ({ type: 'message.delta', sessionId, runId, role: 'agent', msgId: 'answer', text });
const finished = (): AgentEvent => ({ type: 'run.completed', sessionId: session.id, runId: run.id, stopReason: 'end_turn', usage: null });
const approval: ApprovalDto = { callId: 'tool-call', title: 'Read a file', options: [
  { optionId: 'allow', label: 'Allow once', kind: 'allow_once' },
  { optionId: 'reject', label: 'Reject', kind: 'reject_once' },
] };

beforeAll(async () => {
  mock.module('@/lib/backend', () => ({ backendFetch: async (path: string, init?: RequestInit) => {
    calls.push({ path, init });
    init?.signal?.throwIfAborted();
    const emit = (value: AgentEvent) => recorded.push({ id: recorded.length + 1, event: value });
    if (path === '/api/sessions') { initialControls.forEach(emit); return session; }
    if (path.endsWith('/model')) {
      appliedModel = JSON.parse(init!.body as string).modelId;
      emit({ type: 'control.updated', sessionId: session.id, model: { ...availableModels, currentModelId: appliedModel! } });
      return { applied: true };
    }
    if (path.endsWith('/runs')) { log.forEach(emit); return run; }
    if (path.includes('/events?')) {
      const cursor = Number(path.split('after=')[1]);
      return recorded.filter(value => value.id > cursor);
    }
    return {};
  } }));
  execute = (await import('./channel-agent-runner')).runChannelAgent;
});

beforeEach(() => {
  calls.length = 0;
  recorded = [];
  initialControls = [];
  availableModels = { currentModelId: 'account-default', availableModels: [{ id: 'account-default', name: 'Default' }, { id: 'supported-choice', name: 'Available model' }] };
  appliedModel = undefined;
  log = [event({ type: 'run.started', sessionId: session.id, runId: run.id }), delta('A real '), delta('reply.'), finished()];
});

test('returns actual device output and source IDs, excludes thoughts and unrelated runs, then closes its dedicated session', async () => {
  log.splice(2, 0, event({ type: 'thought.delta', sessionId: session.id, runId: run.id, msgId: 'thought', text: 'private reasoning' }), delta('foreign', 'other-session'), delta('another turn', session.id, 'other-run'));
  const result = await execute({ installationId: session.installationId, prompt: 'Hello' });
  expect(result).toEqual({ text: 'A real reply.', sessionId: session.id, runId: run.id });
  const create = calls.find(call => call.path === '/api/sessions')!;
  expect(JSON.parse(create.init!.body as string)).toEqual({ installationId: session.installationId, yoloMode: false });
  expect(calls.at(-1)).toMatchObject({ path: '/api/sessions/device-session', init: { method: 'DELETE' } });
});

test('does not manufacture a successful reply when a completed turn has no agent text', async () => {
  log = [event({ type: 'run.started', sessionId: session.id, runId: run.id }), finished()];
  await expect(execute({ installationId: session.installationId, prompt: 'Hello' })).rejects.toMatchObject({ code: 'empty_response' });
});

test('refuses a tool approval without a user callback and cancels the run', async () => {
  log = [event({ type: 'run.started', sessionId: session.id, runId: run.id }), event({ type: 'approval.required', sessionId: session.id, runId: run.id, approval })];
  await expect(execute({ installationId: session.installationId, prompt: 'Hello' })).rejects.toMatchObject({ code: 'approval_required' });
  expect(calls.some(call => call.path.endsWith('/cancel'))).toBe(true);
  const decision = calls.find(call => call.path.endsWith('/approvals'))!;
  expect(JSON.parse(decision.init!.body as string)).toEqual({ callId: approval.callId, optionId: 'reject' });
});

test('passes only a user-selected offered approval and continues the actual turn', async () => {
  log.splice(1, 0, event({ type: 'approval.required', sessionId: session.id, runId: run.id, approval }));
  const statuses: string[] = [];
  const result = await execute({ installationId: session.installationId, prompt: 'Hello', onStatus: status => statuses.push(status), onApproval: async request => {
    expect(request.callId).toBe(approval.callId);
    return 'allow';
  } });
  expect(result.text).toBe('A real reply.');
  expect(statuses).toContain('waitingApproval');
  expect(JSON.parse(calls.find(call => call.path.endsWith('/approvals'))!.init!.body as string).optionId).toBe('allow');
});

test('a failed device run never becomes a successful channel reply', async () => {
  log = [event({ type: 'run.started', sessionId: session.id, runId: run.id }), delta('Partial'), event({ type: 'run.failed', sessionId: session.id, runId: run.id, message: 'Provider disconnected', recoverable: true })];
  await expect(execute({ installationId: session.installationId, prompt: 'Hello' })).rejects.toMatchObject({ code: 'run_failed', detail: 'Provider disconnected', sessionId: session.id, runId: run.id });
  expect(calls.some(call => call.path.endsWith('/cancel'))).toBe(true);
});

test('model failures retain bounded diagnostics and only this session\'s actual model controls', async () => {
  initialControls = [event({ type: 'control.updated', sessionId: 'another-session', model: { currentModelId: 'foreign', availableModels: [{ id: 'foreign', name: 'Foreign model' }] } }),
    event({ type: 'control.updated', sessionId: session.id, model: availableModels })];
  const detail = `model_not_found: the configured model is not supported with this ChatGPT account. ${'x'.repeat(900)}`;
  log = [event({ type: 'run.started', sessionId: session.id, runId: run.id }), event({ type: 'run.failed', sessionId: session.id, runId: run.id, message: detail, recoverable: true })];
  const failure = await execute({ installationId: session.installationId, prompt: 'Hello' }).catch(error => error);
  expect(failure).toMatchObject({ code: 'model_unavailable', sessionId: session.id, runId: run.id, models: availableModels });
  expect(failure.detail).toBe(detail.slice(0, 800));
});

test('retry selects only an offered model on the new session and waits for actual confirmation before running', async () => {
  initialControls = [event({ type: 'control.updated', sessionId: session.id, model: availableModels })];
  const result = await execute({ installationId: session.installationId, prompt: 'Hello', modelId: 'supported-choice' });
  expect(result.text).toBe('A real reply.');
  expect(appliedModel).toBe('supported-choice');
  const selected = calls.findIndex(call => call.path.endsWith('/model'));
  const sent = calls.findIndex(call => call.path.endsWith('/runs'));
  expect(selected).toBeGreaterThanOrEqual(0);
  expect(calls.slice(selected + 1, sent).some(call => call.path.includes('/events?'))).toBe(true);
});

test('a model from outside the actual session choices cannot be applied or used for a run', async () => {
  initialControls = [event({ type: 'control.updated', sessionId: session.id, model: availableModels })];
  await expect(execute({ installationId: session.installationId, prompt: 'Hello', modelId: 'invented-model' })).rejects.toMatchObject({ code: 'model_unavailable', models: availableModels });
  expect(calls.some(call => call.path.endsWith('/model') || call.path.endsWith('/runs'))).toBe(false);
});

test('caller cancellation explicitly cancels and closes its real device session', async () => {
  const controller = new AbortController();
  await expect(execute({ installationId: session.installationId, prompt: 'Hello', signal: controller.signal, onStatus: status => {
    if (status === 'running') controller.abort();
  } })).rejects.toMatchObject({ code: 'cancelled' });
  expect(calls.some(call => call.path.endsWith('/cancel'))).toBe(true);
  expect(calls.at(-1)?.init?.method).toBe('DELETE');
});
