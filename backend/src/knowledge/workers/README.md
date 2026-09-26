# Transactional knowledge workers

`appendKnowledgeOutbox(db, event, id?)` runs **inside the same `withKnowledgeTenant` transaction as the domain mutation**. It validates C01, inserts the tenant-scoped outbox and calls Graphile's SQL `add_job` through that same connection. Never call it using an unrelated pool query or outside the domain transaction. An enqueue error rolls back the entire operation.

The queue payload is only `{workspaceId, outboxId}`. The dispatcher locks that exact tenant outbox row, validates its event, schedules the statically registered topic consumers and sets `dispatchedAt` in one transaction. An unregistered topic fails visibly instead of being discarded. Consumer handlers fetch the validated event under tenant RLS and perform slow external work outside the read transaction. Consumer names are fixed server code, not file paths supplied in requests.

```ts
await withKnowledgeTenant(pool, trustedWorkspaceId, async (db) => {
  await updateDomainState(db);
  await appendKnowledgeOutbox(db, validatedEvent, stableMutationEventId);
});

const worker = await startKnowledgeWorker({
  pool,
  consumers: [{ name: 'index_document', topic: 'doc.changed', handle: indexDocument }],
});
// Stop before closing the caller-owned pool. Handlers must honor context.signal.
await worker.close();
```

## Delivery and idempotency

- Delivery is **at least once**, not exactly once. A process can fail after a consumer's domain/external effect commits and before queue completion. Use `context.idempotencyKey` (stable consumer/workspace/outbox tuple), conditional writes/current revisions, and external idempotency keys where available. A non-idempotent external action needs its own recoverable domain state machine; the queue cannot make it exactly once.
- Exact replay of an existing outbox ID/payload is a no-op even after the Graphile job has been deleted. Reusing that ID with different content fails. Do not garbage-collect outbox dedup records without a defined retention/replay horizon.
- The default is 25 attempts with Graphile exponential backoff. Exhausted jobs remain retained for diagnosis and explicit retry; they are not silently deleted. After fixing a cause, an operator can use Graphile's public `rescheduleJobs` API to reset attempts and schedule the selected jobs. Never blindly clear all failed jobs.
- Dispatch fan-out and its marker are atomic. Do not change an already dispatched event's consumer mapping expecting retroactive scheduling; a new replay/backfill operation must be explicit.
- No document-UUID queue names or per-page global scans. Jobs use stable keys but no named serial queue. Handlers must tolerate concurrency and out-of-order completion by checking authoritative revisions.

## Bootstrap and privileges

Pinned `graphile-worker@0.18.0` owns its `knowledge_jobs` schema. `initializeKnowledgeJobs(admin, application)` runs its official infrastructure bootstrap, revokes PUBLIC privileges, and grants the existing non-owner/NOBYPASSRLS application role only required DML, sequence and function access. Runtime cannot create tables, truncate queue tables, or modify the migration table. The dependency's bootstrap history is not a legacy compatibility/migration layer for Fouc business data.

Graphile normally assumes a schema-owner connection and enables RLS with no policies. Our bootstrap instead installs a role-specific `worker_runtime` policy on its RLS-protected infrastructure tables and forces RLS; it never disables or broadens `knowledge.*` tenant policies. Queue scheduling metadata is server-global. Real event bodies remain in tenant-scoped outbox; the HTTP/Web client has no database access. Ordinary runtime startup refuses administrative roles and never receives the admin URL.

Initialize the current business schema first, then run `bun backend/scripts/knowledge-jobs.ts init`. Use an application pool with room for Graphile's LISTEN connection plus concurrent handler transactions (typically `max >= concurrency + 2`). The runner does not own/close that pool. It installs and removes only its own sanitized idle/active socket handlers.

## Shutdown and crash recovery

`close()` is idempotent, stops taking work, signals cooperative cancellation after the configured grace period (default 5 seconds), and drains completion/failure updates. Version 0.18's non-batched completion path is fire-and-forget; zero-delay **flushable** batchers are explicitly enabled so `close()` does not return with pending lock-release writes. No signal handlers are installed globally; the R01 composition layer owns process shutdown.

An abruptly killed worker leaves jobs durable and locked. The pinned upstream implementation resets locks older than **four hours** during its maintenance cycle. This is not an immediate-recovery SLA. For faster controlled recovery, use the public `forceUnlockWorkers` API **only after proving the owning process/pool is stopped**; the stored `locked_by` identifier is the pool lock owner in this version. Never unlock a healthy/partitioned worker merely because a request is slow. A subsequent retry still requires consumer idempotency.

All handler errors are converted to fixed `KnowledgeJobError` codes before Graphile persists `last_error`. Logs/observer events do not contain raw SQL, event bodies, provider errors, URLs or credentials. Observer failures do not affect queue correctness. `health()` checks runner lifetime and database reachability; it is not a claim that all queued work has succeeded.

## Verification

`bun test backend/src/knowledge/workers/workers.integration.test.ts` creates a uniquely named disposable PostgreSQL database. It verifies role grants/RLS, domain/outbox/job rollback, concurrent dedup, completed dedup retention, real retries and idempotent effects, fan-out fault rollback, exhausted-job recovery, invalid/cross-tenant references, clean shutdown and a genuinely killed child followed by confirmed-dead unlock/recovery. Fault injection into private queue tables is restricted to this pinned-version disposable test; production business code uses the documented SQL/library APIs.

The test does not wait four real hours or claim live cloud failover. Process orchestration, user-visible job status and concrete index/media/ACL handlers are subsequent DAG tasks.

References: [SQL jobs](https://worker.graphile.org/docs/sql-add-job), [job keys](https://worker.graphile.org/docs/job-key), [schema and restricted roles](https://worker.graphile.org/docs/schema), [public administrative functions](https://worker.graphile.org/docs/admin-functions).
