/* exported renderDiagram, hardware, fitBoard, revealSelection */
"use strict";

// Geometry is expressed in board coordinates; cards keep their intrinsic size.
const DIAGRAM = {
  width: 1080,
  height: 466,
  rowTop: 40,
  rowGap: 144,
  cardHeight: 126,
  instanceX: 456,
  instanceWidth: 236,
  resourceX: 764,
  entryY: 247,
};

function hardware(row, selected = -1, mini = false) {
  if (mini)
    return /* HTML */ `<div class="hardware-mini" aria-hidden="true">${icon("Server")}</div>`;
  return /* HTML */ `
    <div class="hardware-detail" aria-hidden="true">
      ${icon("Server")}
      <div class="hardware-device-grid">
        ${Array.from(
          { length: 8 },
          (_, slot) => /* HTML */ `
            <span
              class="hardware-device ${slot < 4 && row.id !== "i3" ? "mine" : ""}
            ${slot === selected ? "selected" : ""}"
            >
              ${icon("Cpu")}
            </span>
          `,
        ).join("")}
      </div>
    </div>
  `;
}

function matchesInstance(row) {
  if (state.search) {
    return `${row.name} ${row.host} ${row.ip} ${row.role}`
      .toLowerCase()
      .includes(state.search.toLowerCase());
  }
  return state.filter !== "error" || (!row.healthy && !row.building);
}

function diagramSelection(id) {
  return state.selected === id ? " selected" : "";
}

function diagramDim(row) {
  return matchesInstance(row) ? "" : " dim";
}

function instanceStatus(row) {
  if (row.building) {
    return ["资源准备", "模型加载", "等待就绪", "就绪 · 待接流"][state.progress];
  }
  if (!row.healthy) return "异常停止";
  if (state.isolated.includes(row.id)) return "流量已隔离";
  return row.load > 80 ? "高负载" : "运行中";
}

function renderRequestLinks(rows) {
  const { instanceX, instanceWidth, resourceX, entryY, rowTop, rowGap, cardHeight } = DIAGRAM;
  const instanceRight = instanceX + instanceWidth;
  const firstY = rowTop + cardHeight / 2;
  const branches = rows
    .map((row, index) => {
      const y = rowTop + index * rowGap + cardHeight / 2;
      const inactive = !row.healthy || row.building || state.isolated.includes(row.id);
      const kv = state.mode === "pd" && index > 0;
      const path = kv
        ? `M${instanceRight} ${firstY} C738 ${firstY} 738 ${y} ${instanceRight} ${y}`
        : `M400 ${entryY} C430 ${entryY} 426 ${y} ${instanceX} ${y}`;
      return /* HTML */ `
        <g class="${diagramDim(row)}" data-related="${row.id}">
          ${!inactive ? /* HTML */ `<path class="flow-rail" d="${path}" />` : ""}
          <path class="${inactive ? "stopped" : kv ? "kv" : "flow"}" d="${path}" />
          ${!inactive
            ? /* HTML */ `
                <circle class="flow-dot" r="2">
                  <animateMotion
                    dur="${3 + index * 0.6}s"
                    repeatCount="indefinite"
                    path="${path}"
                  />
                </circle>
              `
            : ""}
          <path class="carry" d="M${instanceRight} ${y} H${resourceX}" />
        </g>
      `;
    })
    .join("");
  return /* HTML */ `
    <svg class="request-links" aria-hidden="true">
      <path class="flow-rail" d="M184 ${entryY}H228" />
      <path class="flow" d="M184 ${entryY}H228" />
      <circle class="flow-dot" r="2">
        <animateMotion dur="2s" repeatCount="indefinite" path="M184 ${entryY}H228" />
      </circle>
      ${branches}
    </svg>
  `;
}

function renderInstanceCard(row, index) {
  const isolated = state.isolated.includes(row.id);
  const status = instanceStatus(row);
  const statusType = row.building
    ? "blue"
    : !row.healthy
      ? "bad"
      : isolated
        ? "gray"
        : row.load > 80
          ? "warn"
          : "";
  const statusDot =
    row.building || isolated ? "muted" : !row.healthy ? "bad" : row.load > 80 ? "warn" : "good";
  const serving = row.healthy && !row.building && !isolated;
  const details = serving
    ? /* HTML */ `
        <span>${icon("Activity")} ${row.qps} req/s</span>
        <b>${row.role || "接流中"}</b>
        <span>TTFT ${row.ttft} ms</span><span></span>
      `
    : /* HTML */ `
        <span
          >${row.building
            ? "配置已复用 · node-04"
            : isolated
              ? "新请求 0 · 在途 0"
              : "0 req/s · 已摘流"}</span
        >
        <span></span>
        <span
          >${row.building
            ? "等待就绪与接流"
            : isolated
              ? "保留实例用于排查"
              : "ExitCode 137 · 待核查"}</span
        >
      `;
  return /* HTML */ `
    <button
      class="node instance-node${!row.healthy && !row.building ? " error" : ""}
        ${row.building ? " building" : ""}${diagramSelection(row.id)}${diagramDim(row)}"
      style="left:${DIAGRAM.instanceX}px;top:${DIAGRAM.rowTop + index * DIAGRAM.rowGap}px"
      data-select="${row.id}"
      data-object="${row.id}"
      aria-haspopup="menu"
      aria-label="${row.name} ${status}"
      title="右键查看实例操作"
    >
      <span class="instance-head">
        <span class="dot ${statusDot}"></span>
        <strong>${row.name}</strong>
        ${row.role ? /* HTML */ `<span class="role-label">${row.role}</span>` : ""}
        ${tag(status, statusType)}
      </span>
      <span class="metrics">${details}</span>
      ${serving
        ? /* HTML */ `
            <svg
              class="instance-trend ${row.load > 80 ? "warn" : ""}"
              viewBox="0 0 70 24"
              aria-hidden="true"
            >
              <path
                d="M0 19 8 15 15 19 22 9 30 14 37 7 44 13 52 8 60 12 70 3"
                fill="none"
                stroke="currentColor"
                stroke-width="1.3"
              />
            </svg>
          `
        : ""}
    </button>
  `;
}

function renderResourceCard(row, index) {
  const num = row.id.slice(1);
  const selected =
    diagramSelection(`n${num}`) || (state.selected.startsWith(`g${num}-`) ? " selected" : "");
  return /* HTML */ `
    <article
      class="node resource-node${selected}${diagramDim(row)}"
      style="left:${DIAGRAM.resourceX}px;top:${DIAGRAM.rowTop + index * DIAGRAM.rowGap}px"
      data-object="n${num}"
    >
      <button
        class="host-head"
        data-select="n${num}"
        data-object="n${num}"
        aria-haspopup="menu"
        aria-label="查看节点 ${row.host}"
      >
        <span class="dot good"></span>
        <strong>${row.host}</strong>
        <span class="host-ip">${row.ip}</span>
        <span class="host-load ${row.load > 80 ? "warn" : ""}"
          >${row.load > 80 ? "高负载" : "健康"}</span
        >
      </button>
      <div class="resource-body">
        ${hardware(row, -1, true)}
        <div>
          <span class="host-model"
            >Ascend 910B · ${row.id === "i3" ? "原实例无绑定" : "4 卡并行"}</span
          >
          <div class="slots">
            ${[0, 1, 2, 3]
              .map((slot) => {
                const load = Math.max(0, row.load - [5, 1, 9, 4][slot]);
                return /* HTML */ `
                  <button
                    class="slot${diagramSelection(`g${num}-${slot}`)}"
                    data-select="g${num}-${slot}"
                    data-object="g${num}-${slot}"
                    aria-haspopup="menu"
                    aria-label="${row.host} NPU${slot} 资源详情"
                  >
                    NPU${slot}<strong>${load}%</strong>
                    <span class="meter ${row.load > 80 ? "warn" : ""}">
                      <i style="width:${load}%"></i>
                    </span>
                  </button>
                `;
              })
              .join("")}
          </div>
        </div>
      </div>
    </article>
  `;
}

function renderDiagram() {
  const rows = instances();
  const liveQps = rows
    .filter((row) => row.healthy && !row.building && !state.isolated.includes(row.id))
    .reduce((total, row) => total + Number(row.qps), 0)
    .toFixed(1);
  const heading = (title, left, number) => /* HTML */ `
    <span class="column-label" style="left:${left}px"><small>${number}</small>${title}</span>
  `;
  $("board").style.height = `${Math.max(DIAGRAM.height, 34 + rows.length * DIAGRAM.rowGap)}px`;
  $("board").innerHTML = /* HTML */ `
    ${heading("服务入口", 24, "01")} ${heading("部署版本", 228, "02")}
    ${heading(state.mode === "pd" ? "推理实例 · P/D" : "推理实例", 456, "03")}
    ${heading("节点与卡组", 764, "04")} ${renderRequestLinks(rows)}
    <button
      class="node service-node${diagramSelection("service")}"
      data-select="service"
      data-object="service"
      aria-haspopup="menu"
      title="右键查看服务操作"
    >
      <span class="service-identity"
        ><span class="node-icon">${icon("Network")}</span>
        <strong class="node-title">AI-Coding</strong></span
      >
      <span class="node-caption">${liveQps} req/s · HTTPS</span>
    </button>
    <button
      class="node deploy-node${diagramSelection("deployment")}"
      data-select="deployment"
      data-object="deployment"
      aria-haspopup="menu"
      title="右键查看部署操作"
    >
      <span class="deployment-symbol">${icon("Box")}</span>
      <span class="deploy-label">正式版本</span>
      <span class="deploy-version">v1.2.0</span>
      <span class="deploy-foot"
        ><span class="dot"></span>
        ${state.mode === "pd" ? "P/D 分离" : "标准推理 · TP 4"} · 100%
      </span>
    </button>
    ${rows
      .map((row, index) => renderInstanceCard(row, index) + renderResourceCard(row, index))
      .join("")}
    ${state.cleared && !state.created
      ? /* HTML */ ` <div class="board-note">实例-03 已清理<br />配置快照已保存在变更任务中</div> `
      : ""}
    ${state.mode === "pd" ? /* HTML */ `<span class="kv-label">KV 传输</span>` : ""}
    ${state.search && !rows.some(matchesInstance)
      ? /* HTML */ ` <div class="board-empty">未找到匹配对象，请调整搜索词。</div> `
      : ""}
  `;
  fitBoard();
  highlightRelated();
}

function fitBoard() {
  const canvas = $("canvas");
  if (!canvas.clientWidth) return;
  const boardHeight = $("board").offsetHeight;
  const topSpace = 62;
  const bottomSpace = 38;
  const fitted = Math.min(
    (canvas.clientWidth - 36) / DIAGRAM.width,
    (canvas.clientHeight - topSpace - bottomSpace) / boardHeight,
    1.1,
  );
  // Preserve legibility in narrow panes. Scrolling exposes the full board.
  const scale = Math.max(0.78, fitted) * state.zoom;
  const width = Math.max(canvas.clientWidth, DIAGRAM.width * scale + 36);
  const height = Math.max(canvas.clientHeight, boardHeight * scale + topSpace + bottomSpace);
  canvas.classList.toggle(
    "scrollable",
    width > canvas.clientWidth + 1 || height > canvas.clientHeight + 1,
  );
  $("board-space").style.width = `${width}px`;
  $("board-space").style.height = `${height}px`;
  $("board").style.transform = `scale(${scale})`;
  $("board").style.left = `${Math.max(18, (width - DIAGRAM.width * scale) / 2)}px`;
  $("board").style.top =
    `${topSpace + Math.max(0, (height - topSpace - bottomSpace - boardHeight * scale) / 2)}px`;
  $("zoom-label").textContent = `${Math.round(scale * 100)}%`;
}

function revealSelection() {
  requestAnimationFrame(() => {
    const target = document.querySelector(`#board [data-object="${state.selected}"]`);
    const card = target?.closest(".resource-node") || target;
    card?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  });
}
