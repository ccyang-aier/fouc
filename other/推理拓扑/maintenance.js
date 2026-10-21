/* exported maintenanceActions, renderMaintenanceBanner, resetHardware, renderAuxiliaryHosts */
"use strict";

const MAINTENANCE_PHASES = [
  "暂停新调度",
  "补建替换副本",
  "等待运行就绪",
  "切换请求接流",
  "排空原负载",
  "进入维护",
];
let maintenanceDraft = null;
let maintenanceTimer = null;

function maintenanceCandidates(draft) {
  const needed = draft.jobs.reduce((sum, job) => sum + job.slots.length, 0);
  const free = maintenanceFreeSlots(7).length;
  return [
    {
      key: 7,
      title: "node-07",
      detail: `Ascend 910B · ${free} 张空闲卡 · 模型可访问 · 网络与角色匹配`,
      valid: free >= needed && draft.sourceKey !== 7,
      reason: free >= needed ? "全部匹配" : "空闲卡不足",
    },
    {
      key: 5,
      title: "node-05",
      detail: "Ascend 910B · 仅 2 张空闲卡，无法容纳本次卡组",
      valid: false,
      reason: "容量不足",
    },
    {
      key: 6,
      title: "node-06",
      detail: "资源采集已过期，无法确认健康与可用容量",
      valid: false,
      reason: "数据过期",
    },
  ];
}

function maintenanceFreeSlots(key, jobs = hardwareWorkloads(key)) {
  const occupied = new Set(jobs.flatMap((job) => job.slots));
  return Array.from({ length: 8 }, (_, slot) => slot).filter(
    (slot) => !occupied.has(slot),
  );
}

function openMaintenance() {
  if (invocationBusy() || hardwareBusy()) return;
  const context = resourceContext();
  if (!context || context.slot >= 0) return;
  if (hostScheduling(context.key) === "维护中") {
    openRestore(context.key);
    return;
  }
  const jobs = hardwareWorkloads(context.key);
  maintenanceDraft = { sourceKey: context.key, jobs, step: 0, targetKey: null };
  const candidate = maintenanceCandidates(maintenanceDraft).find(
    (item) => item.valid,
  );
  maintenanceDraft.targetKey = jobs.length ? candidate?.key || null : null;
  showMaintenance(true);
}

function maintenanceScope(draft) {
  const cards = draft.jobs.reduce((sum, job) => sum + job.slots.length, 0);
  const requests = draft.jobs.reduce((sum, job) => sum + job.inFlight, 0);
  const remaining = activeInstances().filter(
    (row) => row.hostKey !== draft.sourceKey,
  ).length;
  return /* HTML */ `<div class="maintenance-scope">
      <span>${draft.jobs.length} 个承载实例</span><span>${cards} / 8 张卡</span
      ><span>${requests} 个在途请求</span>
    </div>
    <div class="maintenance-job-list">
      ${draft.jobs
        .map(
          (job) =>
            /* HTML */ `<article class="hardware-job">
              <div>
                <strong>${job.name}</strong>${tag(
                  job.current ? "当前服务" : "其他服务",
                  job.current ? "" : "gray",
                )}
              </div>
              <p>
                ${job.service} · ${job.role} · TP ${job.slots.length} · NPU
                ${job.slots[0]}–${job.slots.at(-1)}
              </p>
              <div class="hardware-job-foot">
                <span>${job.qps} req/s</span><span>在途 ${job.inFlight}</span>
              </div>
            </article>`,
        )
        .join("") ||
      /* HTML */ `<div class="panel-box quiet">
        节点当前没有业务负载，可直接进入维护。
      </div>`}
    </div>
    <p class="maintenance-impact">
      ${icon("CircleAlert")}维护覆盖节点全部业务。AI-Coding 在其他节点保留
      ${remaining} 个接流实例；替换副本实际接流后，原负载才开始排空。
    </p>`;
}

function showMaintenance(open = false) {
  const draft = maintenanceDraft;
  const host = hardwareHost(draft.sourceKey);
  const cards = draft.jobs.reduce((sum, job) => sum + job.slots.length, 0);
  const content =
    draft.step === 0
      ? maintenanceScope(draft)
      : /* HTML */ `<p class="modal-summary">
            为 ${draft.jobs.length} 个实例选择替换节点，需 ${cards}
            张同型卡。模型、引擎、TP 配置和 P/D 角色保持一致。
          </p>
          ${cards
            ? /* HTML */ `<div class="candidates">
                ${maintenanceCandidates(draft)
                  .map(
                    (item) =>
                      /* HTML */ `<label
                        class="candidate ${item.valid ? "" : "disabled"}"
                        ><input
                          type="radio"
                          name="maintenance-target"
                          value="${item.key}"
                          ${draft.targetKey === item.key ? "checked" : ""}
                          ${item.valid ? "" : "disabled"}
                        />
                        <div>
                          <strong>${item.title}</strong>
                          <p>${item.detail}</p>
                        </div>
                        ${tag(item.reason, item.valid ? "" : "gray")}</label
                      >`,
                  )
                  .join("")}
              </div>`
            : /* HTML */ `<div class="panel-box quiet">
                无承载实例，无需替换节点。
              </div>`}
          <div class="maintenance-plan">
            <span>${host.host}</span>${icon("ArrowRight")}<span
              >${cards
                ? hardwareHost(draft.targetKey)?.host || "暂无可用目标"
                : "直接维护"}</span
            >
          </div>
          <p class="quiet">
            提交时再次校验容量和健康。本地演示将展示完整执行过程。
          </p>`;
  const body = /* HTML */ `<div class="maintenance-context">
      <strong>${host.host}</strong
      ><span>${host.ip} · KunLun G5680 V2</span>${tag("本地演示", "gray")}
    </div>
    <ol class="maintenance-nav">
      <li class="${draft.step === 0 ? "current" : "done"}">1 核对影响</li>
      <li class="${draft.step === 1 ? "current" : ""}">2 选择目标</li>
      <li>3 执行与验证</li>
    </ol>
    ${content}`;
  const ready =
    !cards ||
    maintenanceCandidates(draft).some(
      (item) => item.key === draft.targetKey && item.valid,
    );
  const footer =
    draft.step === 0
      ? /* HTML */ `<button data-action="close-modal">取消</button
          ><button class="primary" data-action="maintenance-next">
            选择替换节点
          </button>`
      : /* HTML */ `<button data-action="maintenance-back">上一步</button
          ><button
            class="primary"
            data-action="maintenance-start"
            ${ready ? "" : "disabled"}
          >
            确认并开始维护
          </button>`;
  if (open) showModal("节点维护", body, footer);
  else {
    $("modal-body").innerHTML = body;
    $("modal-footer").innerHTML = footer;
  }
  $("modal").dataset.hardware = "maintenance";
}

function maintenanceRecord(task) {
  return state.records.find((record) => record.maintenanceId === task.id);
}

function showMaintenanceProgress(open = false) {
  const focusedAction = document.activeElement?.dataset.action;
  const task = state.maintenance;
  if (!task) return;
  const source = hardwareHost(task.sourceKey);
  const target = hardwareHost(task.targetKey);
  const complete = task.phase === 5;
  const initialRequests = task.jobs.reduce((sum, job) => sum + job.inFlight, 0);
  const remainingRequests = complete
    ? 0
    : task.phase === 4
      ? task.jobs.reduce((sum, job) => sum + Math.min(2, job.inFlight), 0)
      : initialRequests;
  const body = /* HTML */ `<div class="maintenance-context">
      <strong>${source.host}</strong
      ><span>${target ? `替换至 ${target.host}` : "无业务负载"}</span>${tag(
        "本地演示",
        "gray",
      )}
    </div>
    <ol class="maintenance-phases">
      ${MAINTENANCE_PHASES.map(
        (label, index) =>
          /* HTML */ `<li
            class="${index < task.phase || complete
              ? "done"
              : index === task.phase
                ? "current"
                : ""}"
          >
            <span class="phase-mark"
              >${index < task.phase || complete
                ? icon("Check")
                : index + 1}</span
            >
            <div>
              <strong>${label}</strong>
              <p>
                ${[
                  "停止向原节点放置新实例，已有请求继续处理。",
                  `复用 ${task.jobs.length} 个实例的模型、启动参数与并行配置。`,
                  "检查模型加载、设备绑定与各角色就绪状态。",
                  "替换副本已就绪，沿用原接流策略；原副本停止接收新请求。",
                  `原节点在途请求 ${initialRequests} → ${remainingRequests}，等待旧副本退出。`,
                  task.status === "returned"
                    ? "节点健康检查通过，已恢复调度；业务继续运行在替换节点。"
                    : "业务负载全部迁出，卡绑定已释放，节点保持不可调度。",
                ][index]}
              </p>
            </div>
            ${index === task.phase && !complete ? tag("执行中", "gray") : ""}
          </li>`,
      ).join("")}
    </ol>
    ${complete
      ? /* HTML */ `<div class="maintenance-result">
          ${icon("Check")}
          <div>
            <strong
              >${task.status === "returned"
                ? "已恢复节点调度"
                : "节点已进入维护"}</strong
            >
            <p>
              ${task.jobs.length}
              个实例${target
                ? `已在 ${target.host} 就绪，接流策略保留`
                : "无需迁出"}
              · 原节点在途 0 · 设备绑定 0
            </p>
          </div>
        </div>`
      : /* HTML */ `<p class="quiet">
          关闭窗口后继续执行，可通过画布上的维护状态重新打开。
        </p>`}`;
  const footer = complete
    ? /* HTML */ `<button data-action="maintenance-view-source">
          查看原节点</button
        >${target
          ? /* HTML */ `<button
              class="primary"
              data-action="maintenance-view-target"
            >
              查看替换节点
            </button>`
          : /* HTML */ `<button class="primary" data-action="close-modal">
              完成
            </button>`}`
    : /* HTML */ `<button
          data-action="maintenance-abort"
          ${task.phase >= 3
            ? 'disabled title="已切换接流，等待原负载排空"'
            : ""}
        >
          取消维护</button
        ><button data-action="close-modal">后台继续</button>`;
  if (open) showModal("节点维护 · 执行结果", body, footer);
  else {
    $("modal-body").innerHTML = body;
    $("modal-footer").innerHTML = footer;
  }
  $("modal").dataset.hardware = "progress";
  if (focusedAction) {
    const focus =
      $("modal-footer").querySelector(
        `[data-action="${focusedAction}"]:not(:disabled)`,
      ) || $("modal-footer").querySelector("button:not(:disabled)");
    focus?.focus({ preventScroll: true });
  }
}

function advanceMaintenance() {
  const task = state.maintenance;
  if (!task || task.status !== "running") return;
  task.phase += 1;
  if (task.phase === 3) {
    task.jobs.forEach((job) => {
      const allocation = {
        key: task.targetKey,
        slots: task.allocations[job.id],
      };
      if (job.current) state.placements[job.id] = allocation;
      else state.externalPlacements[Number(job.id.split("-")[1])] = allocation;
    });
  }
  if (task.phase === 5) {
    task.status = "complete";
    state.scheduling[task.sourceKey] = "维护中";
    const record = maintenanceRecord(task);
    record.result = "已完成";
    record.note = "全部承载业务已迁出，原节点在途请求与设备绑定均为 0";
    toast(`${hardwareHost(task.sourceKey).host} 已进入维护`);
  }
  render();
  if ($("modal").open && $("modal").dataset.hardware === "progress")
    showMaintenanceProgress();
  if (task.phase < 5) maintenanceTimer = setTimeout(advanceMaintenance, 1400);
}

function startMaintenance() {
  if (invocationBusy() || hardwareBusy()) return;
  const draft = maintenanceDraft;
  const current = hardwareWorkloads(draft.sourceKey);
  if (JSON.stringify(current) !== JSON.stringify(draft.jobs)) {
    toast("节点负载已变化，请重新核对影响范围");
    openMaintenance();
    return;
  }
  if (
    draft.jobs.length &&
    !maintenanceCandidates(draft).some(
      (item) => item.key === draft.targetKey && item.valid,
    )
  ) {
    toast("目标资源不满足要求，请重新选择");
    return;
  }
  if (state.trace || $("invoke-dialog").open) closeInvocation();
  const available = draft.jobs.length
    ? maintenanceFreeSlots(draft.targetKey)
    : [];
  const allocations = Object.fromEntries(
    draft.jobs.map((job) => [job.id, available.splice(0, job.slots.length)]),
  );
  const task = (state.maintenance = {
    ...draft,
    id: Date.now(),
    phase: 0,
    status: "running",
    allocations,
  });
  state.scheduling[task.sourceKey] = "已暂停调度";
  state.records.unshift({
    maintenanceId: task.id,
    name: "节点维护",
    target: hardwareHost(task.sourceKey).host,
    time: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
    result: "执行中",
    note: "替换副本接流后，再排空原节点",
  });
  render();
  showMaintenanceProgress();
  maintenanceTimer = setTimeout(advanceMaintenance, 1400);
}

function renderMaintenanceBanner() {
  const task = state.maintenance;
  const banner = $("hardware-maintenance-banner");
  banner.hidden = !task || task.status === "returned" || !!state.trace;
  $("architecture").disabled = invocationBusy() || hardwareBusy();
  document
    .querySelector('[data-action="create"]')
    ?.toggleAttribute("disabled", hardwareBusy());
  document
    .querySelector('[data-action="invoke"]')
    ?.toggleAttribute("disabled", hardwareBusy());
  if (task)
    banner.innerHTML = /* HTML */ `${icon(
        task.status === "running" ? "Clock" : "Wrench",
      )}<span
        >${hardwareHost(task.sourceKey).host} ·
        ${task.status === "running"
          ? MAINTENANCE_PHASES[task.phase]
          : hostScheduling(task.sourceKey)}</span
      >`;
}

function renderAuxiliaryHosts(rows) {
  return Object.keys(state.scheduling)
    .map(Number)
    .filter((key) => !rows.some((row) => row.hostKey === key))
    .map(
      (key, index) =>
        /* HTML */ `<button
          class="maintenance-origin"
          style="bottom:${12 + index * 48}px"
          data-select="n${key}"
          data-object="n${key}"
          aria-haspopup="menu"
        >
          ${icon("Server")}<strong>${hardwareHost(key).host}</strong
          ><span>${hostScheduling(key)}</span
          ><small>${hardwareWorkloads(key).length} 个承载实例</small>
        </button>`,
    )
    .join("");
}

function openRestore(key = resourceContext()?.key) {
  if (hostScheduling(key) !== "维护中") return;
  maintenanceDraft = { sourceKey: key };
  showModal(
    "恢复节点调度",
    /* HTML */ `<p class="modal-summary">
        ${hardwareHost(key).host} 健康检查、驱动检查与设备发现均已通过，8
        张卡可用。
      </p>
      <div class="scope-box">
        <p class="quiet">
          恢复后允许放置新实例。已迁出的业务继续运行在替换节点，不自动迁回。
        </p>
      </div>`,
    /* HTML */ `<button data-action="close-modal">取消</button
      ><button class="primary" data-action="maintenance-confirm-restore">
        恢复调度
      </button>`,
  );
  $("modal").dataset.hardware = "restore";
}

function resetHardware() {
  clearTimeout(maintenanceTimer);
  maintenanceDraft = null;
}

const maintenanceActions = {
  "node-maintenance": openMaintenance,
  "maintenance-next": () => {
    maintenanceDraft.step = 1;
    showMaintenance();
    document.querySelector('[name="maintenance-target"]:checked')?.focus();
  },
  "maintenance-back": () => {
    maintenanceDraft.step = 0;
    showMaintenance();
    $("modal-footer").querySelector(".primary")?.focus();
  },
  "maintenance-start": startMaintenance,
  "maintenance-reopen": () => showMaintenanceProgress(true),
  "maintenance-restore": () => openRestore(),
  "maintenance-confirm-restore": () => {
    state.scheduling[maintenanceDraft.sourceKey] = "可调度";
    if (state.maintenance?.sourceKey === maintenanceDraft.sourceKey)
      state.maintenance.status = "returned";
    closeModal();
    render();
    toast("节点已恢复调度，业务继续运行在替换节点");
  },
  "maintenance-abort": () => {
    const task = state.maintenance;
    if (!hardwareBusy() || task.phase >= 3) return;
    clearTimeout(maintenanceTimer);
    state.scheduling[task.sourceKey] = "可调度";
    maintenanceRecord(task).result = "已取消";
    maintenanceRecord(task).note =
      "在接流切换前取消，原负载保持运行，节点已恢复调度";
    state.maintenance = null;
    closeModal();
    render();
    toast("维护已取消，原节点继续接流并恢复调度");
  },
  "maintenance-view-source": () => {
    closeModal();
    selectObject(`n${state.maintenance.sourceKey}`);
  },
  "maintenance-view-target": () => {
    closeModal();
    selectObject(`n${state.maintenance.targetKey}`);
    state.detailTab = "workloads";
    renderInspector();
  },
};

document.addEventListener("change", (event) => {
  if (!event.target.matches('[name="maintenance-target"]')) return;
  maintenanceDraft.targetKey = Number(event.target.value);
  showMaintenance();
});
