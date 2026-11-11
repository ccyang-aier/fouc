import { setTimeout as delay } from 'node:timers/promises';

/** Cold page compilation gets its own budget; backend checks remain independent. */
export async function waitForReady(service, { child, fetchResponse = fetch, now = Date.now, sleep = delay, onWaiting = () => {} } = {}) {
  const deadline = now() + service.timeoutMs;
  let nextNotice = now() + 15_000;
  while (now() < deadline) {
    if (child && child.exitCode !== null) return false;
    try {
      const response = await fetchResponse(service.url, {
        signal: AbortSignal.timeout(Math.max(1, Math.min(service.requestTimeoutMs, deadline - now()))),
      });
      if (response.status === 200) {
        if (!service.jsonHealth) { await response.text(); return true; }
        if ((await response.json()).ok === true) return true;
      } else await response.body?.cancel();
    } catch { /* Compilation, listener startup and watch restarts can take time. */ }
    if (now() >= nextNotice) { onWaiting(); nextNotice = now() + 15_000; }
    if (now() < deadline) await sleep(Math.min(500, deadline - now()));
  }
  return false;
}
