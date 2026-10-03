type Pending = { signal: AbortSignal; start: () => void; reject: (error: unknown) => void };
type Pool = { active: number; pending: Pending[]; concurrency: number };
const pools = new Map<string, Pool>();
/** Shared per authorized session: cancelled, uninterruptible driver reads retain their slots. */
export function schemaSearchQueue(signal: AbortSignal, concurrency = 3, scopeKey?: string) {
  let pool: Pool = scopeKey ? pools.get(scopeKey) ?? { active: 0, pending: [], concurrency } : { active: 0, pending: [], concurrency };
  if (scopeKey) pools.set(scopeKey, pool);
  const idle = () => { if (scopeKey && !pool.active && !pool.pending.length && pools.get(scopeKey) === pool) pools.delete(scopeKey); };
  const drain = () => {
    while (pool.active < pool.concurrency && pool.pending.length) { const entry = pool.pending.shift()!; if (entry.signal.aborted) entry.reject(entry.signal.reason); else entry.start(); }
    idle();
  };
  const abort = () => { pool.pending = pool.pending.filter((entry) => { if (entry.signal === signal) { entry.reject(signal.reason); return false; } return true; }); drain(); };
  signal.addEventListener('abort', abort);
  return {
    run<T>(read: () => Promise<T>): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        if (signal.aborted) { reject(signal.reason); return; }
        if (scopeKey) { const existing = pools.get(scopeKey); if (existing) pool = existing; else pools.set(scopeKey, pool); }
        pool.pending.push({ signal, reject, start: () => {
          pool.active++;
          let ended = false;
          const cancelled = () => { if (!ended) reject(signal.reason); };
          signal.addEventListener('abort', cancelled, { once: true });
          void Promise.resolve().then(() => { signal.throwIfAborted(); return read(); }).then((value) => { if (signal.aborted) reject(signal.reason); else resolve(value); }, reject).finally(() => { ended = true; signal.removeEventListener('abort', cancelled); pool.active--; drain(); });
        } });
        drain();
      });
    },
    dispose() { signal.removeEventListener('abort', abort); idle(); },
  };
}
