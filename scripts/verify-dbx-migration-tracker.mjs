import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const plan = readFileSync(".spec/tasks/dbx-full-capability-migration.md", "utf8");
const baseline = readJson("shared/catalog/dbx-catalog.json");
const tracker = readJson(".spec/tasks/dbx-migration-tracker.json");

const planIds = [...plan.matchAll(/^\| ([FCSQGDAXPR]\d\d) \|/gm)].map((match) => match[1]);
const taskIds = tracker.tasks.map((task) => task.id);
const driverIds = baseline.drivers.map((driver) => driver.dbType);
const profileIds = baseline.profiles.map((profile) => profile.id);
const driverById = new Map(baseline.drivers.map((driver) => [driver.dbType, driver]));
const validEntries = new Set(tracker.entryPointValues);
const validStatuses = new Set(tracker.statusValues);
const statusLabels = { pending: "待实施", "in-progress": "进行中", completed: "已完成" };
const sha256 = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");

assert.equal(baseline.sourceRevision, tracker.dbxRevision);
assert.equal(baseline.drivers.length, 81);
assert.equal(baseline.profiles.length, 104);
assert.equal(baseline.dialects.length, 35);
assert.equal(new Set(driverIds).size, driverIds.length, "duplicate driver type");
assert.equal(new Set(profileIds).size, profileIds.length, "duplicate connection profile");
assert.equal(baseline.sourceHashes.driverManifestSha256.length, 64);
assert.equal(baseline.sourceHashes.profileCatalogSha256.length, 64);
assert.equal(Object.keys(baseline.sourceHashes.dialectFilesSha256).length, 35);
const sourceManifest = "opensource/dbx/crates/dbx-core/assets/database-drivers.manifest.json";
if (existsSync(sourceManifest)) {
  assert.equal(sha256(sourceManifest), baseline.sourceHashes.driverManifestSha256);
  assert.equal(sha256("opensource/dbx/plugins/connection-types/profiles/catalog.yaml"), baseline.sourceHashes.profileCatalogSha256);
  const sourceDialectFiles = readdirSync("opensource/dbx/plugins/dialects").filter((name) => name.endsWith(".yaml")).sort();
  assert.deepEqual(Object.keys(baseline.sourceHashes.dialectFilesSha256), sourceDialectFiles);
  for (const file of sourceDialectFiles) {
    assert.equal(sha256(`opensource/dbx/plugins/dialects/${file}`), baseline.sourceHashes.dialectFilesSha256[file]);
  }
} else {
  console.warn("DBX source checkout unavailable; validating committed catalog and task tracker only.");
}
const dialects = new Set(baseline.dialects.map((descriptor) => descriptor.dialect.name));
assert.equal(dialects.size, baseline.dialects.length, "duplicate SQL dialect");
for (const driver of baseline.drivers) {
  if (driver.dialect) assert.ok(dialects.has(driver.dialect), `${driver.dbType} references missing SQL dialect`);
}
assert.equal(tracker.sourceBaseline, "shared/catalog/dbx-catalog.json");
assert.equal(tracker.sourcePlan, ".spec/tasks/dbx-full-capability-migration.md");
assert.equal(new Set(planIds).size, planIds.length, "duplicate plan task ID");
assert.equal(new Set(taskIds).size, taskIds.length, "duplicate tracker task ID");
assert.deepEqual(taskIds, planIds, "tracker and plan tasks differ or have drifted in order");

for (const profile of baseline.profiles) {
  assert.ok(driverById.has(profile.dbType), `profile ${profile.id} has no driver`);
  assert.ok(plan.includes(`| \`${profile.id}\` | \`${profile.dbType}\` |`), `missing profile ${profile.id} in plan`);
}

for (const task of tracker.tasks) {
  assert.ok(task.owner, `${task.id} has no owner`);
  assert.ok(validStatuses.has(task.status), `${task.id} has invalid status`);
  assert.ok(task.sourceReference, `${task.id} has no DBX source reference`);
  assert.ok(task.dbxAvailability, `${task.id} has no DBX availability classification`);
  assert.ok(["platform", "driver"].includes(task.scopeKind), `${task.id} has no scope kind`);
  assert.equal(task.applicableDriverTypes.length > 0, task.scopeKind === "driver");
  assert.equal(new Set(task.applicableDriverTypes).size, task.applicableDriverTypes.length);
  for (const driver of task.applicableDriverTypes) {
    assert.ok(driverById.has(driver), `${task.id} references unknown driver ${driver}`);
  }
  for (const entry of ["desktop", "web", "cli", "mcp"]) {
    assert.ok(validEntries.has(task.entryPoints[entry]), `${task.id} has invalid ${entry} scope`);
  }
  assert.equal(task.regressionCase.id, `MIG-${task.id}-01`);
  assert.ok(task.regressionCase.setup && task.regressionCase.action && task.regressionCase.expected);
  assert.ok(Array.isArray(task.acceptanceEvidence));
  const taskRow = plan.split("\n").find((line) => line.startsWith(`| ${task.id} |`));
  assert.ok(taskRow?.trimEnd().endsWith(`| ${statusLabels[task.status]} |`), `${task.id} status differs from plan`);
  if (task.status === "completed") {
    assert.ok(task.acceptedAt, `${task.id} is completed without acceptance date`);
    assert.ok(task.acceptanceEvidence.length > 0, `${task.id} is completed without evidence`);
  }
}

const driverTasks = tracker.tasks.filter((task) => task.id.startsWith("R"));
assert.equal(driverTasks.length, baseline.drivers.length);
for (let index = 0; index < driverTasks.length; index += 1) {
  assert.deepEqual(driverTasks[index].applicableDriverTypes, [driverIds[index]]);
  assert.ok(plan.includes(`| ${driverTasks[index].id} | \`${driverIds[index]}\` |`));
}

const completed = tracker.tasks.filter((task) => task.status === "completed").length;
console.log(
  `DBX migration tracker verified: ${taskIds.length} tasks (${completed} completed), ${driverIds.length} drivers, ${profileIds.length} profiles.`,
);
