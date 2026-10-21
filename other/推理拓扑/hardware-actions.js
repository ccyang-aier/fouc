/* exported hardwareActions, hardwareMenuEntries, paintHardwareLocation, hardwareWorkloadPanel */
"use strict";

const CARD_METRICS = [
  ["utilization", "算力使用率", "%", 100],
  ["memory", "显存使用", "GiB", 64],
  ["temperature", "温度", "°C", 100],
  ["power", "功耗", "W", 400],
  ["bandwidth", "通信带宽", "GB/s", 40],
];
let cardComparison = null;

function hardwareMenuEntries(id) {
  const context = resourceContext(id);
  const busy = invocationBusy() || hardwareBusy();
  const common = [
    {
      label: "查看监控",
      icon: "ChartNoAxesCombined",
      action: "object-metrics",
    },
    { label: "查看事件", icon: "Clock", action: "object-events" },
  ];
  if (context.slot >= 0)
    return [
      ...common,
      { divider: true },
      {
        label: "定位关联实例",
        icon: "Network",
        action: "hardware-locate-instance",
        disabled: busy || !context.job,
      },
      {
        label: "定位物理槽位",
        icon: "Cpu",
        action: "hardware-locate-slot",
        disabled: busy,
      },
      {
        label: "定位所在节点",
        icon: "Server",
        action: "hardware-locate-host",
        disabled: busy,
      },
      {
        label: "对比同组卡",
        icon: "GitCompareArrows",
        action: "hardware-compare",
        disabled: !context.job,
        reason: !context.job ? "当前卡未绑定实例，无同组卡" : "",
      },
      { divider: true },
      { label: "复制设备信息", icon: "Copy", action: "hardware-copy" },
    ];
  const restored = hostScheduling(context.key) === "维护中";
  return [
    ...common,
    { label: "查看承载实例", icon: "Layers", action: "hardware-workloads" },
    { label: "查看硬件详情", icon: "FileText", action: "object-config" },
    { label: "复制 IP", icon: "Copy", action: "hardware-copy" },
    { divider: true },
    {
      label: restored ? "恢复调度" : "进入维护",
      icon: "Wrench",
      action: restored ? "maintenance-restore" : "node-maintenance",
      disabled: busy,
    },
  ];
}

function paintHardwareLocation() {
  const location = state.location;
  if (!location || state.trace) return;
  const context = resourceContext(location.source);
  if (!context) return;
  const rowId =
    context.slot < 0
      ? context.jobs.find((job) => job.current)?.id
      : context.job?.current
        ? context.job.id
        : null;
  const board = $("board");
  board
    .querySelectorAll("[data-related], [data-trace-node]")
    .forEach((item) => {
      item.classList.toggle(
        "location-path",
        !!rowId && (item.dataset.related || item.dataset.traceNode) === rowId,
      );
    });
  board
    .querySelector(`[data-object="${location.target}"]`)
    ?.classList.add("location-target");
}

function locateHardware(kind, explicitId) {
  const source = explicitId || state.selected;
  const context = resourceContext(source);
  if (!context || invocationBusy() || hardwareBusy()) return;
  if (state.trace || $("invoke-dialog").open) closeInvocation();
  const target =
    kind === "host"
      ? `n${context.key}`
      : kind === "instance" && context.job?.current
        ? context.job.id
        : source;
  state.filter = "all";
  state.search = "";
  if ($("modal").open) closeModal();
  selectObject(target);
  if (kind === "instance" && !context.job?.current) {
    state.selected = `n${context.key}`;
    state.detailTab = "workloads";
    renderInspector();
  }
  state.location = { source, target };
  paintHardwareLocation();
  requestAnimationFrame(() => {
    if (kind === "slot") {
      const slot = document.querySelector(
        `.chassis-slot[data-object="${source}"]`,
      );
      slot
        ?.closest(".physical-machine-panel")
        ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      slot?.classList.add("slot-located");
      slot?.focus({ preventScroll: true });
    } else
      document
        .querySelector(`#board [data-object="${target}"]`)
        ?.focus({ preventScroll: true });
  });
  toast(
    kind === "slot"
      ? `已定位 ${context.host.host} · NPU${context.slot} 物理槽位`
      : kind === "host"
        ? `已定位 ${context.host.host}`
        : context.job?.current
          ? `已定位 ${context.job.name} · TP 4 卡组`
          : "已定位其他服务的承载记录",
  );
}

function hardwareWorkloadPanel(host) {
  const jobs = hardwareWorkloads(host.key);
  const used = jobs.reduce((sum, job) => sum + job.slots.length, 0);
  return /* HTML */ `<section class="detail-section hardware-workloads">
    <h3>承载实例<small>${used} / 8 张卡已分配</small></h3>
    ${jobs.length
      ? jobs
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
                  ${job.service} · ${job.role} · NPU
                  ${job.slots[0]}–${job.slots.at(-1)}
                </p>
                <div class="hardware-job-foot">
                  <span
                    >${job.draining
                      ? `排空中 · 在途 ${job.inFlight}`
                      : `${job.qps} req/s`}</span
                  >
                  ${job.current
                    ? /* HTML */ `<button
                        class="read-link"
                        data-action="hardware-job-locate"
                        data-value="${job.id}"
                      >
                        定位实例 ${icon("ArrowRight")}
                      </button>`
                    : /* HTML */ `<span>位于其他服务拓扑</span>`}
                </div>
              </article>`,
          )
          .join("")
      : /* HTML */ `<div class="panel-box">
          <p class="quiet">节点上已无业务实例，8 张加速卡空闲。</p>
        </div>`}
    <p class="quiet">
      节点维护覆盖以上全部负载；当前服务拓扑只绘制 AI-Coding。
    </p>
  </section>`;
}

function openCardComparison(id = state.selected) {
  if (!hardwareGroup(id)) return;
  cardComparison = { id, metric: "utilization" };
  showCardComparison(true);
}

function showCardComparison(open = false) {
  const group = hardwareGroup(cardComparison.id);
  if (!group) return;
  const cards = group.slots.map((slot) => ({
    slot,
    ...cardTelemetry(group.key, slot),
  }));
  const [metric, label, unit, max] = CARD_METRICS.find(
    ([key]) => key === cardComparison.metric,
  );
  const selectedSlot = resourceContext(cardComparison.id).slot;
  const bandwidths = cards.map((card) => card.bandwidth).sort((a, b) => a - b);
  const middle = (bandwidths[1] + bandwidths[2]) / 2;
  const slow = cards.find((card) => card.bandwidth < middle * 0.75);
  const body = /* HTML */ `<div class="hardware-compare-meta">
      <span>${group.host.host} · ${group.job.name} · TP ${cards.length}</span>
      <select aria-label="卡组对比观察时段" data-hardware-period>
        <option value="15" ${state.period === "15" ? "selected" : ""}>
          最近15分钟
        </option>
        <option value="60" ${state.period === "60" ? "selected" : ""}>
          最近1小时
        </option>
      </select>
    </div>
    <div class="hardware-metric-tabs" role="tablist" aria-label="卡组对比指标">
      ${CARD_METRICS.map(
        ([key, title]) =>
          /* HTML */ `<button
            role="tab"
            aria-selected="${key === metric}"
            data-action="hardware-compare-metric"
            data-value="${key}"
          >
            ${title}
          </button>`,
      ).join("")}
    </div>
    <div
      class="hardware-bars"
      role="group"
      aria-label="${label}同组对比，单位${unit}"
    >
      ${cards
        .map(
          (card) =>
            /* HTML */ `<div
              class="hardware-bar-row ${card.slot === selectedSlot
                ? "is-current"
                : ""}"
            >
              <button
                data-action="hardware-compare-select"
                data-value="g${group.key}-${card.slot}"
                aria-pressed="${card.slot === selectedSlot}"
              >
                NPU ${card.slot}</button
              ><span
                ><i
                  style="width:${Math.max(1, (card[metric] / max) * 100)}%"
                ></i></span
              ><b>${card[metric]}<small>${unit}</small></b>
            </div>`,
        )
        .join("")}
    </div>
    <div class="hardware-table-wrap">
      <table class="compare-table hardware-card-table">
        <caption>
          同组卡指标 · 演示数据，温度为时段峰值，其余为时段均值
        </caption>
        <thead>
          <tr>
            <th scope="col">指标</th>
            ${cards
              .map(
                (card) =>
                  /* HTML */ `<th
                    scope="col"
                    class="${card.slot === selectedSlot ? "is-current" : ""}"
                  >
                    NPU ${card.slot}
                  </th>`,
              )
              .join("")}
          </tr>
        </thead>
        <tbody>
          ${CARD_METRICS.map(
            ([key, title, suffix]) =>
              /* HTML */ `<tr class="${key === metric ? "active-metric" : ""}">
                <th scope="row">${title} <small>${suffix}</small></th>
                ${cards
                  .map(
                    (card) =>
                      /* HTML */ `<td
                        class="${card.slot === selectedSlot
                          ? "is-current"
                          : ""}"
                      >
                        ${card[key]}
                      </td>`,
                  )
                  .join("")}
              </tr>`,
          ).join("")}
        </tbody>
      </table>
    </div>
    ${slow
      ? /* HTML */ `<p class="hardware-finding">
          ${icon("CircleAlert")}NPU ${slow.slot} 的通信带宽比组内中位数低
          ${Math.round(
            (1 - slow.bandwidth / middle) * 100,
          )}%，可结合事件继续排查。
        </p>`
      : /* HTML */ `<p class="quiet">
          当前时段未见明显组内带宽差异；指标差异不单独作为硬件故障结论。
        </p>`}`;
  const footer = /* HTML */ `<button data-action="close-modal">关闭</button
    ><button
      class="primary"
      data-action="hardware-compare-locate"
      data-value="${cardComparison.id}"
    >
      定位 NPU${selectedSlot} 槽位
    </button>`;
  if (open) showModal("同组加速卡对比", body, footer);
  else {
    $("modal-body").innerHTML = body;
    $("modal-footer").innerHTML = footer;
  }
  $("modal").dataset.hardware = "compare";
}

async function copyHardware() {
  const context = resourceContext();
  if (!context) return;
  const text =
    context.slot < 0
      ? context.host.ip
      : [
          `节点：${context.host.host}`,
          `IP：${context.host.ip}`,
          `设备：Ascend 910B · NPU${context.slot}`,
          `设备 ID：${context.host.host}/npu/${context.slot}`,
          `序列号：DEMO-910B-${context.key}${String(context.slot).padStart(3, "0")}`,
          `关联实例：${context.job ? `${context.job.service} / ${context.job.name}` : "空闲"}`,
        ].join("\n");
  try {
    await navigator.clipboard.writeText(text);
    toast(context.slot < 0 ? `已复制 ${context.host.ip}` : "已复制设备信息");
  } catch {
    showModal(
      "复制信息",
      /* HTML */ `<p class="quiet">请选择并复制以下信息。</p>
        <textarea class="hardware-copy-text" readonly aria-label="待复制信息">
${text}</textarea
        >`,
    );
  }
}

const hardwareActions = {
  "hardware-locate-instance": () => locateHardware("instance"),
  "hardware-locate-slot": () => locateHardware("slot"),
  "hardware-locate-host": () => locateHardware("host"),
  "hardware-workloads": () => {
    state.detailTab = "workloads";
    renderInspector();
  },
  "hardware-compare": () => openCardComparison(),
  "hardware-copy": copyHardware,
  "hardware-compare-metric": (button) => {
    cardComparison.metric = button.dataset.value;
    showCardComparison();
    document
      .querySelector(
        `[data-action="hardware-compare-metric"][data-value="${button.dataset.value}"]`,
      )
      ?.focus();
  },
  "hardware-compare-select": (button) => {
    cardComparison.id = button.dataset.value;
    showCardComparison();
    document
      .querySelector(
        `[data-action="hardware-compare-select"][data-value="${button.dataset.value}"]`,
      )
      ?.focus();
  },
  "hardware-compare-locate": (button) =>
    locateHardware("slot", button.dataset.value),
  "hardware-job-locate": (button) => {
    const row = instances().find((item) => item.id === button.dataset.value);
    if (row) locateHardware("instance", `g${row.hostKey}-${row.slots[0]}`);
  },
};

document.addEventListener("change", (event) => {
  if (!event.target.matches("[data-hardware-period]")) return;
  state.period = event.target.value;
  $("period").value = state.period;
  renderInspector();
  showCardComparison();
  document.querySelector("[data-hardware-period]")?.focus();
});
