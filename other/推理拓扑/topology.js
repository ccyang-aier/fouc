/* exported renderDiagram, fitBoard, revealSelection, instanceStatus */
"use strict";

const DIAGRAM = {
  width: 1080,
  height: 466,
  rowTop: 40,
  rowGap: 144,
  cardHeight: 126,
  modelX: 24,
  modelWidth: 190,
  instanceX: 330,
  instanceWidth: 218,
  acceleratorX: 662,
  acceleratorWidth: 136,
  hostX: 900,
  hostWidth: 158,
};

function matchesInstance(row) {
  if (state.search)
    return `${row.name} ${row.host} ${row.ip} ${row.role}`
      .toLowerCase()
      .includes(state.search.toLowerCase());
  return state.filter !== "error" || (!row.healthy && !row.building);
}
function diagramSelection(id) {
  return state.selected === id ? " selected" : "";
}
function diagramDim(row) {
  return matchesInstance(row) ? "" : " dim";
}
function instanceStatus(row) {
  if (row.building)
    return ["资源准备", "模型加载", "等待就绪", "就绪 · 待接流"][
      state.progress
    ];
  if (!row.healthy) return "异常停止";
  if (state.isolated.includes(row.id)) return "已隔离";
  return row.load > 80 ? "高负载" : "运行中";
}
function rowCenter(index) {
  return DIAGRAM.rowTop + index * DIAGRAM.rowGap + DIAGRAM.cardHeight / 2;
}
function modelCenter(rows) {
  if (state.trace?.origin === "model") {
    const index = rows.findIndex((row) => row.id === state.trace.route[0]);
    if (index >= 0) return rowCenter(index);
  }
  return rowCenter(Math.floor((rows.length - 1) / 2));
}
function acceleratorY(index, slot) {
  return DIAGRAM.rowTop + index * DIAGRAM.rowGap + 6 + slot * 30;
}

function renderRequestLinks(rows) {
  const modelY = modelCenter(rows);
  return /* HTML */ ` <svg class="request-links" aria-hidden="true">
    ${rows
      .map((row, index) => {
        const y = rowCenter(index);
        const inactive =
          !row.healthy || row.building || state.isolated.includes(row.id);
        const kv = state.mode === "pd" && row.role === "Decode";
        const path = kv
          ? `M330 ${rowCenter(0)} C278 ${rowCenter(0)} 278 ${y} 330 ${y}`
          : `M214 ${modelY} C270 ${modelY} 274 ${y} 330 ${y}`;
        return /* HTML */ ` <g
          class="edge-branch${diagramDim(row)}"
          data-related="${row.id}"
        >
          <path
            class="request-edge ${inactive ? "stopped" : kv ? "kv" : "flow"}"
            data-trace-row="${row.id}"
            data-route-segment="request"
            d="${path}"
          />
          ${[0, 1, 2, 3]
            .map((slot) => {
              const cardY = acceleratorY(index, slot) + 12;
              const compute = `M548 ${y} C600 ${y} 610 ${cardY} 662 ${cardY}`;
              const host = `M798 ${cardY} C850 ${cardY} 846 ${y} 900 ${y}`;
              return /* HTML */ `
                <path
                  class="compute-edge ${inactive ? "stopped" : "compute"}"
                  data-trace-row="${row.id}"
                  data-route-segment="compute"
                  d="${compute}"
                />
                <path
                  class="host-edge carry"
                  data-trace-row="${row.id}"
                  data-route-segment="host"
                  d="${host}"
                />
              `;
            })
            .join("")}
        </g>`;
      })
      .join("")}
  </svg>`;
}

function renderInstanceCard(row, index) {
  const isolated = state.isolated.includes(row.id);
  const serving = row.healthy && !row.building && !isolated;
  const type = row.building
    ? "blue"
    : !row.healthy
      ? "bad"
      : isolated
        ? "gray"
        : row.load > 80
          ? "warn"
          : "";
  return /* HTML */ ` <button
    class="node instance-node${!row.healthy && !row.building ? " error" : ""}
      ${row.building ? "building" : ""}${diagramSelection(row.id)}${diagramDim(
      row,
    )}"
    style="left:330px;top:${DIAGRAM.rowTop + index * DIAGRAM.rowGap}px"
    data-select="${row.id}"
    data-object="${row.id}"
    data-trace-node="${row.id}"
    aria-haspopup="menu"
    aria-label="${row.name} ${instanceStatus(row)}"
    title="右键查看实例操作"
  >
    <span class="instance-head">
      <span
        class="dot ${serving
          ? row.load > 80
            ? "warn"
            : "good"
          : !row.healthy && !row.building
            ? "bad"
            : "muted"}"
      ></span>
      <strong>${row.name}</strong>
      ${row.role
        ? /* HTML */ `<span class="role-label">${row.role}</span>`
        : ""}
      ${tag(instanceStatus(row), type)}
    </span>
    <span class="metrics">
      <span
        >${serving
          ? `${row.qps} req/s`
          : row.building
            ? "等待就绪与接流"
            : isolated
              ? "新请求 0 · 在途 0"
              : "0 req/s · 已摘流"}</span
      >
      <b>${serving ? "接流中" : ""}</b>
      <span
        >${serving
          ? `TTFT ${row.ttft} ms`
          : row.building
            ? "原配置已复用"
            : isolated
              ? "保留实例用于排查"
              : "ExitCode 137 · 待核查"}</span
      >
    </span>
    ${serving
      ? /* HTML */ ` <svg
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
        </svg>`
      : ""}
  </button>`;
}

function renderAccelerators(row, index) {
  const number = row.id.slice(1);
  return [0, 1, 2, 3]
    .map((slot) => {
      const load = Math.max(0, row.load - [5, 1, 9, 4][slot]);
      return /* HTML */ ` <button
        class="node accelerator-node${diagramSelection(
          `g${number}-${slot}`,
        )}${diagramDim(row)}"
        style="left:662px;top:${acceleratorY(index, slot)}px"
        data-select="g${number}-${slot}"
        data-object="g${number}-${slot}"
        data-trace-node="${row.id}"
        data-trace-kind="accelerator"
        aria-haspopup="menu"
        aria-label="${row.host} NPU${slot} 资源详情"
      >
        ${icon("Cpu")}<span>NPU ${slot}</span
        ><strong class="${row.load > 80 ? "warn" : ""}">${load}%</strong>
      </button>`;
    })
    .join("");
}

function renderPhysicalNode(row, index) {
  const number = row.id.slice(1);
  return /* HTML */ ` <button
    class="node physical-node${diagramSelection(`n${number}`)}${diagramDim(
      row,
    )}"
    style="left:900px;top:${DIAGRAM.rowTop + index * DIAGRAM.rowGap}px"
    data-select="n${number}"
    data-object="n${number}"
    data-trace-node="${row.id}"
    data-trace-kind="host"
    aria-haspopup="menu"
    aria-label="查看节点 ${row.host}"
  >
    <span class="physical-identity"
      >${icon("Server")}<strong>${row.host}</strong></span
    >
    <span class="host-ip">${row.ip}</span>
    <span class="physical-throughput"
      >${state.isolated.includes(row.id)
        ? "0"
        : row.healthy && !row.building
          ? "2,480"
          : "—"}<small>tokens/s</small></span
    >
    <span class="physical-status"><span class="dot good"></span>资源健康</span>
  </button>`;
}

function renderDiagram() {
  const rows = instances();
  const heading = (title, left, order, detail = "") =>
    /* HTML */ ` <span class="column-label" style="left:${left}px"
      ><small>${order}</small>${title}
      ${detail ? /* HTML */ `<em>${detail}</em>` : ""}</span
    >`;
  $("board").style.height =
    `${Math.max(DIAGRAM.height, 34 + rows.length * DIAGRAM.rowGap)}px`;
  $("board").innerHTML = /* HTML */ ` ${heading("模型", 24, "01")}${heading(
      "推理实例",
      330,
      "02",
    )}
    ${heading("加速卡", 662, "03", "Ascend 910B")}${heading(
      "物理节点",
      900,
      "04",
    )}
    ${renderRequestLinks(rows)}
    <button
      class="node model-node${diagramSelection("model")}"
      style="top:${modelCenter(rows) - 74}px"
      data-select="model"
      data-object="model"
      data-trace-model
      aria-haspopup="menu"
      aria-label="模型 Qwen3-32B"
      title="右键查看模型操作"
    >
      <span class="model-symbol">${icon("Box")}</span>
      <strong>Qwen3-32B</strong
      ><span class="model-version">正式版本 · v1.2.0</span>
      <span class="model-foot"
        >${state.mode === "pd" ? "Prefill / Decode" : "标准推理"} · TP 4</span
      >
      <span class="model-request" id="model-request-label" hidden
        >本次请求</span
      >
    </button>
    ${rows
      .map(
        (row, index) =>
          renderInstanceCard(row, index) +
          renderAccelerators(row, index) +
          renderPhysicalNode(row, index),
      )
      .join("")}
    ${state.cleared && !state.created
      ? /* HTML */ `<div class="board-note">
          实例-03 已删除<br />配置快照已保存在变更任务中
        </div>`
      : ""}
    ${state.mode === "pd"
      ? /* HTML */ `<span class="kv-label">KV 传输</span>`
      : ""}
    ${state.search && !rows.some(matchesInstance)
      ? /* HTML */ `<div class="board-empty">
          未找到匹配对象，请调整搜索词。
        </div>`
      : ""}`;
  fitBoard();
  highlightRelated();
  paintRequestTrace();
}

function fitBoard() {
  const canvas = $("canvas");
  if (!canvas.clientWidth) return;
  const boardHeight = $("board").offsetHeight;
  const topSpace = 62,
    bottomSpace = 38;
  const fitted = Math.min(
    (canvas.clientWidth - 36) / DIAGRAM.width,
    (canvas.clientHeight - topSpace - bottomSpace) / boardHeight,
    1.1,
  );
  const scale = Math.max(0.78, fitted) * state.zoom;
  const width = Math.max(canvas.clientWidth, DIAGRAM.width * scale + 36);
  const height = Math.max(
    canvas.clientHeight,
    boardHeight * scale + topSpace + bottomSpace,
  );
  canvas.classList.toggle(
    "scrollable",
    width > canvas.clientWidth + 1 || height > canvas.clientHeight + 1,
  );
  $("board-space").style.width = `${width}px`;
  $("board-space").style.height = `${height}px`;
  $("board").style.transform = `scale(${scale})`;
  $("board").style.left =
    `${Math.max(18, (width - DIAGRAM.width * scale) / 2)}px`;
  $("board").style.top =
    `${topSpace + Math.max(0, (height - topSpace - bottomSpace - boardHeight * scale) / 2)}px`;
  $("zoom-label").textContent = `${Math.round(scale * 100)}%`;
}
function revealSelection() {
  requestAnimationFrame(() => {
    document
      .querySelector(`#board [data-object="${state.selected}"]`)
      ?.scrollIntoView({
        block: "nearest",
        inline: "nearest",
        behavior: "smooth",
      });
  });
}
