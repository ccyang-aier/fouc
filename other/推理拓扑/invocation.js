/* exported openInvocation, closeInvocation, invocationBusy, paintRequestTrace, requestRoute */
"use strict";

let invocation = { status: "idle", timer: null, phaseTimers: [], sequence: 0 };

function invocationBusy() {
  return invocation.status === "waiting" || invocation.status === "streaming";
}

function requestRoute(
  origin,
  rows = instances(),
  mode = state.mode,
  isolated = state.isolated,
) {
  const available = rows.filter(
    (row) => row.healthy && !row.building && !isolated.includes(row.id),
  );
  const direct = available.find((row) => row.id === origin);
  if (origin !== "model" && !direct) return [];
  if (mode === "pd") {
    if (direct?.role === "Decode") return [direct.id];
    const prefill = direct || available.find((row) => row.role === "Prefill");
    const decode = available.find((row) => row.role === "Decode");
    return prefill && decode ? [prefill.id, decode.id] : [];
  }
  const target = direct || [...available].sort((a, b) => a.load - b.load)[0];
  return target ? [target.id] : [];
}

function paintRequestTrace() {
  const trace = state.trace;
  const board = $("board");
  board.classList.toggle("request-traced", !!trace);
  board.classList.toggle("request-running", !!trace && invocationBusy());
  board.querySelectorAll("[data-trace-node]").forEach((node) => {
    const involved = trace?.route.includes(node.dataset.traceNode) || false;
    const routeIndex = trace?.route.indexOf(node.dataset.traceNode) ?? -1;
    const stage = (node.dataset.traceKind ? 2 : 1) + (routeIndex > 0 ? 1 : 0);
    const source = !!trace && trace.origin === node.dataset.object;
    node.classList.toggle(
      "trace-active",
      involved && (trace.stage >= stage || source),
    );
    node.classList.toggle("trace-source", source);
    node.classList.toggle("route-muted", !!trace && !involved);
  });
  const model = board.querySelector("[data-trace-model]");
  model?.classList.toggle("trace-active", trace?.origin === "model");
  model?.classList.toggle("trace-source", trace?.origin === "model");
  model?.classList.toggle("route-muted", !!trace && trace.origin !== "model");
  const modelLabel = $("model-request-label");
  if (modelLabel) modelLabel.hidden = trace?.origin !== "model";
  board.querySelectorAll("[data-trace-row]").forEach((edge) => {
    const involved = trace?.route.includes(edge.dataset.traceRow) || false;
    const kind = edge.dataset.routeSegment;
    const downstream = (trace?.route.indexOf(edge.dataset.traceRow) ?? -1) > 0;
    const stage =
      kind === "request"
        ? downstream
          ? 2
          : 0
        : (kind === "compute" ? 1 : 2) + (downstream ? 1 : 0);
    const startsUpstream =
      kind === "request" &&
      trace?.origin !== "model" &&
      trace?.route[0] === edge.dataset.traceRow;
    edge.classList.toggle(
      "trace-edge",
      involved && trace.stage >= stage && !startsUpstream,
    );
    edge.classList.toggle(
      "route-muted",
      !!trace && (!involved || startsUpstream),
    );
  });
  const indicator = $("request-indicator");
  indicator.hidden = !trace;
  if (trace) {
    const status =
      invocation.status === "complete"
        ? "响应完成"
        : invocation.status === "interrupted"
          ? "已中断"
          : ["正在分发", "实例已接收", "算力执行中", "流式输出中"][trace.stage];
    indicator.innerHTML = /* HTML */ `${icon("Activity")}<span
        >${trace.requestId} · ${status}</span
      >`;
  }
}

function positionInvocation() {
  const panel = $("invoke-dialog");
  const workspace = $("workspace").getBoundingClientRect();
  const instance = document
    .querySelector("#board .instance-node")
    ?.getBoundingClientRect();
  const left = Math.max(16, workspace.left + 16);
  const width = Math.min(
    340,
    Math.max(260, (instance?.left || left + 340) - left - 18),
    innerWidth - 32,
  );
  panel.style.left = `${Math.min(left, innerWidth - width - 16)}px`;
  panel.style.right = "auto";
  panel.style.width = `${width}px`;
  const source =
    state.trace?.origin === "model"
      ? document.querySelector("[data-trace-model]")?.getBoundingClientRect()
      : null;
  const top = innerHeight - 24 - panel.offsetHeight;
  const overlapsModel =
    source && top < source.bottom + 12 && innerHeight - 24 > source.top - 12;
  panel.style.top = overlapsModel
    ? `${Math.max(64, source.top - panel.offsetHeight - 12)}px`
    : "auto";
  panel.style.bottom = overlapsModel ? "auto" : "24px";
}

function openInvocation(origin = state.selected) {
  const panel = $("invoke-dialog");
  clearTimeout(toastTimer);
  $("toast").classList.remove("show");
  if (invocationBusy()) {
    if (!panel.open) panel.show();
    return;
  }
  const nextOrigin = /^i/.test(origin) ? origin : "model";
  const changed = invocation.origin !== nextOrigin || !state.trace;
  invocation.origin = nextOrigin;
  const route = requestRoute(invocation.origin);
  if (!route.length) {
    toast("当前对象没有可接流的实例");
    return;
  }
  if (changed) {
    state.trace = null;
    invocation.status = "idle";
    $("invoke-output").textContent = "";
    $("invoke-response").hidden = true;
    $("invoke-metrics").hidden = true;
  }
  $("invoke-target").textContent =
    invocation.origin === "model"
      ? "Qwen3-32B"
      : instances().find((row) => row.id === invocation.origin).name;
  state.inspectorOpen = false;
  state.filter = "all";
  state.search = "";
  state.zoom = 1;
  render();
  if (!panel.open) panel.show();
  positionInvocation();
  $("invoke-input").focus();
}

function invocationControls() {
  const busy = invocationBusy();
  const button = $("invoke-send");
  button.innerHTML = icon(busy ? "Square" : "ArrowUp");
  button.setAttribute("aria-label", busy ? "中断响应" : "发送请求");
  button.title = busy ? "中断响应" : "发送请求";
  button.classList.toggle("is-streaming", busy);
  $("architecture").disabled = busy;
  document.querySelectorAll('[data-action="filter"]').forEach((control) => {
    control.disabled = busy;
  });
}

function demoResponse(prompt) {
  if (/合并|有序数组/.test(prompt))
    return [
      "可以使用双指针，按顺序取出两个数组中较小的元素：\n\n",
      "def merge_sorted(a, b):\n    i = j = 0\n    result = []\n",
      "    while i < len(a) and j < len(b):\n",
      "        if a[i] <= b[j]:\n            result.append(a[i])\n            i += 1\n",
      "        else:\n            result.append(b[j])\n            j += 1\n",
      "    return result + a[i:] + b[j:]\n\n",
      "时间复杂度 O(m + n)，额外空间复杂度 O(m + n)。",
    ].join("");
  if (/你好|hello|hi\b/i.test(prompt)) {
    return "你好！我可以协助你梳理需求、阅读代码、编写函数和分析问题。\n\n你可以告诉我具体的目标与约束，我们从一个清晰、可验证的步骤开始。";
  }
  return `关于「${prompt}」：\n\n可以先明确目标与约束，再把问题拆成输入、处理过程和预期输出三个部分。选择最小的可行方案，用典型样例验证结果，并检查异常输入和边界条件。\n\n如果涉及代码实现，建议同时保留可运行的示例，方便核对行为并继续迭代。`;
}

function clearInvocationTimers() {
  clearTimeout(invocation.timer);
  invocation.phaseTimers.forEach(clearTimeout);
  invocation.phaseTimers = [];
}

function finishInvocation(interrupted = false) {
  if (!invocationBusy()) return;
  clearInvocationTimers();
  const end = performance.now();
  invocation.status = interrupted ? "interrupted" : "complete";
  const ttft = invocation.firstAt
    ? Math.round(invocation.firstAt - invocation.startedAt)
    : null;
  const tpot =
    invocation.samples > 1
      ? Math.round(
          (invocation.lastAt - invocation.firstAt) / (invocation.samples - 1),
        )
      : null;
  $("invoke-metrics").hidden = false;
  $("invoke-metrics").innerHTML = /* HTML */ `
    <span>${interrupted ? "已中断" : "已完成"}</span>
    <span>TTFT <b>${ttft === null ? "—" : `${ttft} ms`}</b></span>
    <span>TPOT <b>${tpot === null ? "—" : `${tpot} ms/token`}</b></span>
    <span>E2E <b>${Math.round(end - invocation.startedAt)} ms</b></span>
  `;
  $("invoke-status").textContent = interrupted ? "响应已中断" : "响应已完成";
  invocationControls();
  paintRequestTrace();
  positionInvocation();
}

function startInvocation() {
  if (invocationBusy()) {
    finishInvocation(true);
    return;
  }
  const prompt = $("invoke-input").value.trim();
  if (!prompt) {
    $("invoke-input").focus();
    return;
  }
  const route = requestRoute(invocation.origin);
  if (!route.length) {
    toast("目标实例当前不可接流，请重新选择");
    return;
  }
  clearInvocationTimers();
  invocation = {
    ...invocation,
    status: "waiting",
    startedAt: performance.now(),
    firstAt: null,
    lastAt: null,
    samples: 0,
    sequence: invocation.sequence + 1,
    phaseTimers: [],
  };
  state.trace = {
    origin: invocation.origin,
    route,
    stage: 0,
    requestId: `REQ-${String(invocation.sequence).padStart(4, "0")}`,
  };
  $("invoke-response").hidden = false;
  $("invoke-output").textContent = "";
  $("invoke-metrics").hidden = true;
  $("invoke-status").textContent = "请求已发送";
  const rows = route.map((id) => instances().find((row) => row.id === id));
  $("invoke-route").textContent =
    `${invocation.origin === "model" ? "模型 → " : ""}${rows.map((row) => row.name).join(" → ")} → NPU 0–3 → ${rows.at(-1).host}`;
  state.filter = "all";
  state.search = "";
  state.zoom = 1;
  invocationControls();
  render();
  invocation.phaseTimers.push(
    setTimeout(() => {
      state.trace.stage = 1;
      paintRequestTrace();
    }, 240),
  );
  invocation.phaseTimers.push(
    setTimeout(() => {
      state.trace.stage = 2;
      paintRequestTrace();
    }, 500),
  );
  const chunks = demoResponse(prompt).match(/[\s\S]{1,3}/g) || [];
  const next = () => {
    const chunk = chunks.shift();
    if (!chunk) {
      finishInvocation();
      return;
    }
    const now = performance.now();
    const firstChunk = !invocation.firstAt;
    if (firstChunk) invocation.firstAt = now;
    invocation.lastAt = now;
    invocation.samples += 1;
    invocation.status = "streaming";
    if (firstChunk) {
      state.trace.stage = 3;
      $("invoke-status").textContent = "正在输出";
      paintRequestTrace();
    }
    $("invoke-output").textContent += chunk;
    $("invoke-output").scrollTop = $("invoke-output").scrollHeight;
    positionInvocation();
    invocation.timer = setTimeout(next, 32);
  };
  invocation.timer = setTimeout(next, 820);
  requestAnimationFrame(() => {
    positionInvocation();
    const target = document.querySelector(`[data-object="${route[0]}"]`);
    target?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
      behavior: "smooth",
    });
  });
}

function closeInvocation() {
  if (invocationBusy()) finishInvocation(true);
  clearInvocationTimers();
  $("invoke-dialog").close();
  state.trace = null;
  renderDiagram();
  document
    .querySelector(`#board [data-object="${invocation.origin}"]`)
    ?.focus({ preventScroll: true });
}

document.querySelector("#invoke-form").addEventListener("submit", (event) => {
  event.preventDefault();
  startInvocation();
});
document.querySelector("#invoke-dialog").addEventListener("cancel", (event) => {
  event.preventDefault();
  closeInvocation();
});

window.addEventListener("resize", () => {
  if ($("invoke-dialog").open) positionInvocation();
});
