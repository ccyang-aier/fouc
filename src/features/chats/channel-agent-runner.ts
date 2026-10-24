import type { AgentEvent, AgentRun, AgentSession, ApprovalDto, ModelSnapshotDto } from '@fouc/shared';
import { backendFetch } from '@/lib/backend';

export type ChannelAgentStatus = 'starting' | 'running' | 'waitingApproval' | 'completed';
export type ChannelAgentErrorCode = 'invalid_input' | 'device_unavailable' | 'authentication_required'
  | 'installation_unavailable' | 'approval_required' | 'approval_rejected' | 'session_failed'
  | 'run_failed' | 'model_unavailable' | 'cancelled' | 'timed_out' | 'empty_response';

export class ChannelAgentRunError extends Error {
  readonly detail?: string;
  constructor(readonly code: ChannelAgentErrorCode, readonly sessionId?: string, readonly runId?: string, detail?: string, readonly models?: ModelSnapshotDto) {
    super(code);
    this.name = 'ChannelAgentRunError';
    this.detail = detail?.trim().slice(0, 800) || undefined;
  }
}

export interface ChannelAgentRunOptions {
  installationId: string;
  prompt: string;
  modelId?: string;
  signal?: AbortSignal;
  onStatus?: (status: ChannelAgentStatus) => void;
  /** Return an offered option ID; null rejects. Omitting this callback never approves tools. */
  onApproval?: (approval: ApprovalDto) => Promise<string | null>;
}

type LoggedEvent = { id: number; event: AgentEvent };

function modelUnavailable(detail?: string): boolean {
  return Boolean(detail && /model_not_found|unknown[\s_-]*model|unsupported[\s_-]*model|model[\s_-]*unsupported|model.{0,160}(?:not\s+supported|unsupported|not\s+available|does\s+not\s+exist|not\s+found)|(?:not\s+supported|unsupported|not\s+available).{0,160}model/is.test(detail));
}

function pause(signal: AbortSignal, milliseconds = 350): Promise<void> {
  return new Promise((resolve, reject) => {
    const cancel = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', cancel); resolve(); }, milliseconds);
    signal.addEventListener('abort', cancel, { once: true });
    if (signal.aborted) cancel();
  });
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const cancel = () => reject(signal.reason);
    signal.addEventListener('abort', cancel, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', cancel));
    if (signal.aborted) cancel();
  });
}

/** A user-triggered run on their own device; only persisted device events become a reply. */
export async function runChannelAgent({ installationId, prompt, modelId, signal: callerSignal, onStatus, onApproval }: ChannelAgentRunOptions): Promise<{ text: string; sessionId: string; runId: string }> {
  if (!installationId || !prompt.trim()) throw new ChannelAgentRunError('invalid_input');
  if (callerSignal?.aborted) throw new ChannelAgentRunError('cancelled');

  const controller = new AbortController();
  const { signal } = controller;
  let timedOut = false;
  const deadline = setTimeout(() => { timedOut = true; controller.abort(); }, 330_000);
  const cancel = () => controller.abort(callerSignal?.reason);
  callerSignal?.addEventListener('abort', cancel, { once: true });
  let sessionId: string | undefined;
  let runId: string | undefined;
  let cursor = 0;
  let completed = false;
  let runRequest: Promise<void> | undefined;
  const controls: { models?: ModelSnapshotDto } = {};
  const chunks: string[] = [];
  const fail = (code: ChannelAgentErrorCode, detail?: string): never => { throw new ChannelAgentRunError(code, sessionId, runId, detail, controls.models); };
  const sessionPath = () => `/api/sessions/${encodeURIComponent(sessionId!)}`;

  async function events() {
    const entries = await backendFetch<LoggedEvent[]>(`${sessionPath()}/events?after=${cursor}`, { signal });
    for (const entry of entries) {
      cursor = Math.max(cursor, entry.id);
      const event = entry.event;
      if (!('sessionId' in event) || event.sessionId !== sessionId) continue;
      if (event.type === 'control.updated' && 'model' in event) controls.models = event.model ?? undefined;
      if (event.type === 'auth.required') fail('authentication_required');
      if (event.type === 'run.started' && !runId) runId = event.runId;
      if (!('runId' in event) || !runId || event.runId !== runId) continue;
      if (event.type === 'message.delta') chunks.push(event.text);
      else if (event.type === 'run.failed') fail(modelUnavailable(event.message) ? 'model_unavailable' : 'run_failed', event.message);
      else if (event.type === 'run.cancelled') fail('cancelled');
      else if (event.type === 'run.completed') completed = true;
      else if (event.type === 'approval.required') {
        onStatus?.('waitingApproval');
        const approval = event.approval;
        const optionId = onApproval ? await abortable(onApproval(approval), signal) : null;
        const selected = approval.options.find(option => option.optionId === optionId);
        const rejection = approval.options.find(option => option.kind === 'reject_once')
          ?? approval.options.find(option => option.kind === 'reject_always');
        const choice = selected ?? rejection;
        if (choice) {
          await backendFetch(`${sessionPath()}/approvals`, {
            method: 'POST', signal, body: JSON.stringify({ callId: approval.callId, optionId: choice.optionId }),
          });
        }
        if (!selected || selected.kind.startsWith('reject')) fail(onApproval ? 'approval_rejected' : 'approval_required');
        onStatus?.('running');
      }
    }
  }

  try {
    onStatus?.('starting');
    // The device owns working-directory selection and launch policy. Do not request YOLO.
    const created = await backendFetch<AgentSession>('/api/sessions', {
      method: 'POST', signal, body: JSON.stringify({ installationId, yoloMode: false }),
    });
    sessionId = created.id;
    if (created.installationId !== installationId) fail('installation_unavailable');
    let session = created;
    const startupDeadline = Date.now() + 45_000;
    while (session.status !== 'active') {
      await events();
      if (['error', 'ended'].includes(session.status)) fail('session_failed');
      if (Date.now() >= startupDeadline) fail('timed_out');
      await pause(signal);
      session = await backendFetch<AgentSession>(sessionPath(), { signal });
      if (session.installationId !== installationId) fail('installation_unavailable');
    }

    await events();
    if (modelId) {
      const modelDeadline = Date.now() + 10_000;
      while (!controls.models) {
        if (Date.now() >= modelDeadline) fail('model_unavailable', 'The Agent did not provide its available models.');
        await pause(signal);
        await events();
      }
      if (!controls.models.availableModels.some(model => model.id === modelId)) fail('model_unavailable', 'The selected model is not available in this Agent session.');
      if (controls.models.currentModelId !== modelId) {
        await backendFetch(`${sessionPath()}/model`, { method: 'POST', signal, body: JSON.stringify({ modelId }) });
        // The HTTP endpoint acknowledges the request before the Agent applies it.
        while (controls.models?.currentModelId !== modelId) {
          await events();
          if (controls.models?.currentModelId === modelId) break;
          if (Date.now() >= modelDeadline) fail('model_unavailable', 'The Agent did not confirm the selected model.');
          await pause(signal);
        }
      }
    }

    onStatus?.('running');
    let runRequestError: unknown;
    // This HTTP endpoint waits for the whole turn, so poll its persisted events concurrently.
    runRequest = backendFetch<AgentRun>(`${sessionPath()}/runs`, {
      method: 'POST', signal, body: JSON.stringify({ input: prompt.trim() }),
    }).then(run => {
      if (run.sessionId !== sessionId || (runId && runId !== run.id)) fail('run_failed');
      runId = run.id;
      if (run.status === 'failed') fail(modelUnavailable(run.exitInfo?.stderr) ? 'model_unavailable' : 'run_failed', run.exitInfo?.stderr);
      if (run.status === 'cancelled') fail('cancelled');
    }).catch(error => { runRequestError = error; });

    while (!completed) {
      await events();
      if (runRequestError) throw runRequestError;
      if (!completed) await pause(signal);
    }
    await runRequest;
    if (runRequestError) throw runRequestError;
    const text = chunks.join('').trim();
    if (!text || !runId) return fail('empty_response');
    onStatus?.('completed');
    return { text, sessionId, runId };
  } catch (error) {
    if (error instanceof ChannelAgentRunError) throw error;
    if (signal.aborted) fail(timedOut ? 'timed_out' : 'cancelled');
    const detail = error instanceof Error ? error.message : typeof error === 'string' ? error : undefined;
    return fail(modelUnavailable(detail) ? 'model_unavailable' : sessionId ? 'run_failed' : 'device_unavailable', detail);
  } finally {
    clearTimeout(deadline);
    callerSignal?.removeEventListener('abort', cancel);
    // Abort an outstanding HTTP turn before issuing cleanup through independent requests.
    controller.abort();
    if (sessionId) {
      if (!completed) await backendFetch(`${sessionPath()}/cancel`, { method: 'POST', body: '{}', signal: AbortSignal.timeout(5_000) }).catch(() => {});
      await backendFetch(sessionPath(), { method: 'DELETE', signal: AbortSignal.timeout(5_000) }).catch(() => {});
    }
    await runRequest;
  }
}
