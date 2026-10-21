/* exported resourceContext, hardwareHost, hardwareWorkloads, cardTelemetry, hardwareBusy, hostScheduling, hardwareGroup, hardwarePlacement */
"use strict";

const HARDWARE_HOSTS = {
  1: { key: 1, host: "node-01", ip: "10.24.8.21" },
  2: { key: 2, host: "node-02", ip: "10.24.8.22" },
  3: { key: 3, host: "node-03", ip: "10.24.8.23" },
  4: { key: 4, host: "node-04", ip: "10.24.8.24" },
  7: { key: 7, host: "node-07", ip: "10.24.8.27" },
};

function hardwareHost(key) {
  return HARDWARE_HOSTS[Number(key)];
}

function hardwareBusy() {
  return state.maintenance?.status === "running";
}

function hardwarePlacement(row) {
  const allocation = state.placements[row.id];
  const key = allocation?.key || Number(row.id.slice(1));
  return {
    ...row,
    hostKey: key,
    slots: allocation?.slots || [0, 1, 2, 3],
    ...hardwareHost(key),
    name: state.placements[row.id] ? `${row.name}-r1` : row.name,
  };
}

function hostScheduling(key) {
  return state.scheduling[key] || "可调度";
}

function hardwareWorkloads(key) {
  const task = state.maintenance;
  if (task?.sourceKey === key && task.phase >= 3 && task.phase < 5) {
    return task.jobs.map((job) => ({
      ...job,
      draining: true,
      inFlight: task.phase === 3 ? job.inFlight : Math.min(2, job.inFlight),
    }));
  }
  const rows = instances().filter(
    (row) => row.hostKey === key && row.healthy && !row.building,
  );
  const jobs = rows.map((row) => ({
    id: row.id,
    name: row.name,
    service: "AI-Coding",
    current: true,
    slots: row.slots,
    role: row.role || "标准推理",
    inFlight: state.isolated.includes(row.id) ? 0 : 8,
    qps: state.isolated.includes(row.id) ? "0" : row.qps,
  }));
  for (const otherSource of [1, 2, 3, 4]) {
    const allocation = state.externalPlacements[otherSource];
    if ((allocation?.key || otherSource) !== key) continue;
    jobs.push({
      id: `other-${otherSource}`,
      name: `问答实例-0${otherSource}${key === 7 ? "-r1" : ""}`,
      service: "知识问答",
      current: false,
      slots: allocation?.slots || [4, 5, 6, 7],
      role: "标准推理",
      inFlight: 3,
      qps: "6.2",
    });
  }
  return jobs;
}

function resourceContext(id = state.selected) {
  const match = /^([ng])(\d+)(?:-(\d+))?$/.exec(id);
  if (!match) return null;
  const key = Number(match[2]);
  const host = hardwareHost(key);
  if (!host) return null;
  const slot = match[1] === "g" ? Number(match[3]) : -1;
  const jobs = hardwareWorkloads(key);
  const job = slot >= 0 ? jobs.find((item) => item.slots.includes(slot)) : null;
  return {
    host,
    key,
    slot,
    jobs,
    job,
    row: instances().find((item) => item.hostKey === key),
  };
}

function hardwareGroup(id) {
  const context = resourceContext(id);
  return context?.job ? { ...context, slots: context.job.slots } : null;
}

function cardTelemetry(key, slot, period = state.period) {
  const job = hardwareWorkloads(key).find((item) => item.slots.includes(slot));
  const row = instances().find((item) => item.hostKey === key);
  const base = job ? (job.current ? row?.load || 48 : 42) : 0;
  const utilization = Math.max(
    0,
    base - [5, 1, 9, 4][slot % 4] - (period === "60" ? 6 : 0),
  );
  const slow = key === 2 && slot === 2;
  return {
    utilization,
    memory: job
      ? Number(
          (42 + slot * 1.2 + (key % 3) - (period === "60" ? 2 : 0)).toFixed(1),
        )
      : 0,
    temperature: job ? 57 + Math.round(base / 9) + (slot % 4) * 2 : 39,
    power: job ? 180 + Math.round(base * 1.7) + (slot % 4) * 7 : 64,
    bandwidth: job
      ? Number(
          (
            (slow ? 19.6 : 30.2 + (slot % 4) * 0.4) -
            (period === "60" ? 1.2 : 0)
          ).toFixed(1),
        )
      : 0,
  };
}
