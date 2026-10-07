import { expect, test } from "bun:test";
import { DatabaseSync } from "node:sqlite";
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  rmdir,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  DATABASE_CAPABILITIES,
  type DatabaseCapabilities,
  type RelationalSession,
} from "@fouc/shared";
import {
  sqliteBackupInputSchema,
  type SqliteBackupScope,
} from "@fouc/shared/sqlite-backup";
import { DatabaseInputError } from "../input-error";
import { createSqliteSnapshot } from "./process";
import { SqliteBackupService } from "./service";

async function fixture() {
  const directory = await mkdtemp(
    path.join(tmpdir(), "fouc-sqlite-backup-test-"),
  );
  const source = path.join(directory, "source.sqlite");
  const writer = new DatabaseSync(source);
  writer.exec(
    "PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0; CREATE TABLE sample(id INTEGER PRIMARY KEY, amount TEXT, payload BLOB); INSERT INTO sample VALUES(9007199254740993,'1234567890.001',X'00FF41')",
  );
  const session: RelationalSession = {
    id: "session",
    connectionId: null,
    provider: "sqlite",
    database: source,
    info: { productName: "SQLite" },
    capabilities: {
      connectionId: "session",
      health: "connected",
      source: "server",
      checkedAt: Date.now(),
      capabilities: Object.fromEntries(
        DATABASE_CAPABILITIES.map((name) => [name, false]),
      ) as DatabaseCapabilities,
      restrictions: { readOnly: true, production: false },
    },
  };
  const scope: SqliteBackupScope = {
    sessionId: session.id,
  };
  let current = session;
  const service = new SqliteBackupService(
    (id) => {
      if (id !== current.id)
        throw new DatabaseInputError("会话不属于当前空间");
      return current;
    },
    path.join(directory, "artifacts"),
  );
  return {
    directory,
    source,
    writer,
    session,
    scope,
    service,
    replaceSession: (value: RelationalSession) => {
      current = value;
    },
    cleanup: async () => {
      await service.close();
      writer.close();
      for (const name of [
        "source.sqlite",
        "download.sqlite",
        "bounded.sqlite",
        "cancelled.sqlite",
      ])
        for (const suffix of ["", "-wal", "-shm", "-journal"])
          await rm(path.join(directory, name + suffix), { force: true });
      await rmdir(directory);
    },
  };
}

async function terminal(
  service: SqliteBackupService,
  scope: SqliteBackupScope,
  id: string,
) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const status = service.status(scope, id);
    if (!["running", "cancelling"].includes(status.status)) return status;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("SQLite fixture backup did not finish");
}

test("backup request rejects device paths, unknown source fields and reserved filenames", () => {
  expect(
    sqliteBackupInputSchema.safeParse({ filename: "snapshot.sqlite" }).success,
  ).toBe(true);
  for (const input of [
    { filename: "../source.sqlite" },
    { filename: "C:\\source.sqlite" },
    { filename: "CON.db" },
    { filename: "db.txt" },
    { filename: "snapshot.db", source: "/private.sqlite" },
    { filename: "snapshot.db", destination: "/target.sqlite" },
  ])
    expect(sqliteBackupInputSchema.safeParse(input).success).toBe(false);
});

test("native snapshot includes committed WAL, exact integers and binary, excludes uncommitted writes; live session scope and stream cleanup stay enforced", async () => {
  const value = await fixture();
  try {
    expect((await stat(value.source + "-wal")).size).toBeGreaterThan(0);
    value.writer.exec(
      "BEGIN IMMEDIATE; INSERT INTO sample VALUES(2,'not committed',NULL)",
    );
    const job = value.service.start(value.scope, {
      filename: "snapshot.sqlite",
    });
    expect(() => value.service.download(value.scope, job.id)).toThrow();
    expect(() =>
      value.service.status(
        { sessionId: "missing-session" },
        job.id,
      ),
    ).toThrow();
    expect(() =>
      value.service.start(value.scope, { filename: "second.db" }),
    ).toThrow();
    const ready = await terminal(value.service, value.scope, job.id);
    expect(ready.status).toBe("ready");
    expect(ready.integrity).toBe("verified");
    expect(ready.bytes).toBeGreaterThan(0);
    expect(JSON.stringify(ready)).not.toContain("artifacts");
    value.writer.exec("ROLLBACK");
    // Lock/unlock replaces the public session object while retaining its actual connection identity.
    value.replaceSession({
      ...value.session,
      capabilities: {
        ...value.session.capabilities,
        restrictions: { readOnly: false, production: false },
      },
    });
    const artifact = value.service.download(value.scope, job.id);
    const chunks: Buffer[] = [];
    for await (const chunk of artifact.stream) chunks.push(Buffer.from(chunk));
    const bytes = Buffer.concat(chunks);
    expect(bytes.length).toBe(ready.bytes!);
    expect(bytes.subarray(0, 16).toString()).toBe("SQLite format 3\u0000");
    const file = path.join(value.directory, "download.sqlite");
    await writeFile(file, bytes);
    // The reader also lives in a child: Bun can retain native statement handles until GC on Windows.
    const script = `const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.argv.at(-1),{readOnly:true});const q=db.prepare('SELECT id, amount, payload FROM sample');q.setReadBigInts(true);const rows=q.all().map(row=>({id:String(row.id),amount:row.amount,payload:Buffer.from(row.payload).toString('hex')}));const journal=db.prepare('PRAGMA journal_mode').get().journal_mode;db.close();console.log(JSON.stringify({rows,journal}));`;
    const { stdout } = await promisify(execFile)(
      process.execPath,
      ["-e", script, file],
      { windowsHide: true },
    );
    const readback = JSON.parse(stdout);
    expect(readback.rows).toEqual([
      { id: "9007199254740993", amount: "1234567890.001", payload: "00ff41" },
    ]);
    expect(readback.journal).toBe("delete");
    const openDownload = value.service.download(value.scope, job.id);
    openDownload.stream.pause();
    await value.service.closeSession(value.scope);
    expect(openDownload.stream.destroyed).toBe(true);
    expect(await readdir(path.join(value.directory, "artifacts"))).toEqual([]);
    expect(value.service.list(value.scope)).toEqual([]);
  } finally {
    await value.cleanup();
  }
});

test("dedicated worker can be interrupted and rejects a byte limit before publishing a snapshot", async () => {
  const value = await fixture();
  try {
    const limited = path.join(value.directory, "bounded.sqlite");
    await expect(
      createSqliteSnapshot(
        value.source,
        limited,
        1024,
        new AbortController().signal,
        () => {},
      ),
    ).rejects.toThrow("字节上限");
    expect(await readFile(limited).catch(() => null)).toBeNull();
    const controller = new AbortController();
    await expect(
      createSqliteSnapshot(
        value.source,
        path.join(value.directory, "cancelled.sqlite"),
        64 * 1024 * 1024,
        controller.signal,
        () => controller.abort(new Error("test native cancellation")),
      ),
    ).rejects.toThrow("test native cancellation");
    const job = value.service.start(value.scope, {
      filename: "cancelled.sqlite",
    });
    expect(value.service.cancel(value.scope, job.id).status).toBe("cancelling");
    expect((await terminal(value.service, value.scope, job.id)).status).toBe(
      "cancelled",
    );
    await value.service.discard(value.scope, job.id);
    expect(value.service.list(value.scope)).toEqual([]);
    expect(await readdir(path.join(value.directory, "artifacts"))).toEqual([]);
  } finally {
    await value.cleanup();
  }
});
