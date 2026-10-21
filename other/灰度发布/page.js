/* exported publishStrip */
"use strict";
const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const ver = {
  old: {
    name: "正式版本",
    model: "DeepSeek-V4.1-Flash",
    id: "V001",
    color: "#2d5cf6",
  },
  new: {
    name: "灰度版本",
    model: "DeepSeek-V4.1-Flash-10.17",
    id: "V002",
    color: "#0e9b8c",
  },
};
const initialKeys = [
  ["研发一组 · AI Coding", "sk-••••7a2f", "new"],
  ["平台团队 · Code Review", "sk-••••9b31", "new"],
  ["研发二组 · AI Coding", "sk-••••2c6d", "old"],
  ["研发三组 · AI Coding", "sk-••••4e82", "old"],
  ["测试团队 · 待接入", "sk-••••1c54", "none"],
];
const baseline = {
  mode: "key",
  targets: initialKeys.map((k) => (k[2] === "new" ? "old" : k[2])),
  weights: { old: 100, new: 0 },
  fault: "fallback",
};
const initialState = () => ({
  mode: "key",
  targets: initialKeys.map((k) => k[2]),
  weights: { old: 80, new: 20 },
  fault: "fallback",
  phase: "observing",
  selected: "new",
  view: "overview",
  tab: "summary",
  period: "60",
  experience: createExperienceState(),
  diff: false,
  oldRunning: true,
  newRunning: true,
  gateway: "active",
  drain: 0,
  records: [],
});
let state = initialState(),
  draft = null,
  modalSubmit = null,
  lastFocus = null,
  gatewayTimer = null,
  drainTimer = null,
  toastTimer = null;
const count = (targets, v) => targets.filter((t) => t === v).length;
function ratios(weights) {
  const a = Number(weights.old),
    b = Number(weights.new);
  if (
    !Number.isFinite(a) ||
    !Number.isFinite(b) ||
    a < 0 ||
    b < 0 ||
    a > 1000 ||
    b > 1000 ||
    !Number.isInteger(a) ||
    !Number.isInteger(b) ||
    a + b === 0
  )
    return null;
  return { old: (100 * a) / (a + b), new: (100 * b) / (a + b) };
}
function plan(kind) {
  if (kind === "finish")
    return {
      mode: state.mode,
      targets: state.targets.map(() => "new"),
      weights: { old: 0, new: 100 },
      fault: state.fault,
    };
  if (kind === "exit") return structuredClone(baseline);
  throw Error("Unknown plan");
}
const sourceTargets = () =>
  state.mode === "key" ? state.targets : state.targets.map(() => "weighted");
const phaseText = () =>
  state.phase === "normal"
    ? "正常服务"
    : state.phase === "observing"
      ? "灰度观察中"
      : state.gateway !== "active"
        ? state.phase === "finished"
          ? "发布生效中"
          : "退出处理中"
        : state.phase === "finished"
          ? "发布已完成"
          : "已退出灰度";
function showToast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.remove("show"), 3400);
}
function addRecord(message) {
  state.records.unshift({
    message,
    time: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
  });
}
function openModal(title, body, footer, submit = null, wide = false) {
  if (!$("modal").open) lastFocus = document.activeElement;
  document
    .querySelectorAll(":popover-open")
    .forEach((popover) => popover.hidePopover());
  $("modal-title").textContent = title;
  $("modal-body").innerHTML = body;
  $("modal-footer").innerHTML = footer;
  modalSubmit = submit;
  $("modal").classList.toggle("wide", wide);
  if (!$("modal").open) $("modal").showModal();
  enhanceSelects($("modal"));
}
function closeModal() {
  if ($("modal").open) $("modal").close();
  modalSubmit = null;
  lastFocus?.focus?.();
}
const cancelButton = '<button data-action="close">取消</button>';

// Enhance native selects with one shared, keyboard-operable popover control.
// The original element retains the value and existing change handlers.
let selectSequence = 0;
function enhanceSelects(root = document) {
  root.querySelectorAll("select").forEach((select) => {
    if (!select.id) select.id = `select-${++selectSequence}`;
    let wrapper = select.nextElementSibling;
    if (!select.dataset.enhanced) {
      select.hidden = true;
      select.dataset.enhanced = "true";
      wrapper = document.createElement("div");
      wrapper.className = "select-wrap";
      select.after(wrapper);
    }
    const menuId = `${select.id}-menu`;
    wrapper.innerHTML = /* HTML */ `
      <button
        class="select-trigger"
        data-action="select-menu"
        aria-haspopup="listbox"
        aria-controls="${menuId}"
        aria-expanded="false"
        aria-label="${esc(select.getAttribute("aria-label") || "选择选项")}"
      >
        <span>${esc(select.selectedOptions[0]?.textContent || "请选择")}</span
        >${icon("down")}
      </button>
      <div
        class="select-menu"
        id="${menuId}"
        popover
        role="listbox"
        aria-label="${esc(select.getAttribute("aria-label") || "选择选项")}"
      >
        ${Array.from(select.options)
          .map(
            (option) => /* HTML */ `
              <button
                class="select-option"
                role="option"
                data-action="select-option"
                data-select-id="${select.id}"
                data-value="${esc(option.value)}"
                aria-selected="${option.selected}"
              >
                ${esc(option.textContent)}${option.selected ? icon("check") : ""}
              </button>
            `,
          )
          .join("")}
      </div>
    `;
  });
}
function togglePopover(trigger, popover) {
  if (popover.matches(":popover-open")) {
    popover.hidePopover();
    return;
  }
  const bounds = trigger.getBoundingClientRect();
  popover.style.left = `${Math.min(bounds.left, window.innerWidth - 300)}px`;
  popover.style.top = `${bounds.bottom + 6}px`;
  if (popover.classList.contains("select-menu")) {
    popover.style.minWidth = `${Math.max(bounds.width, 168)}px`;
    popover.style.maxHeight = `${Math.min(280, window.innerHeight - bounds.bottom - 20)}px`;
  }
  popover.ontoggle = (event) =>
    trigger.setAttribute("aria-expanded", String(event.newState === "open"));
  popover.showPopover();
  const menuBounds = popover.getBoundingClientRect();
  popover.style.left = `${Math.max(8, Math.min(bounds.left, window.innerWidth - menuBounds.width - 8))}px`;
  if (
    bounds.bottom + menuBounds.height + 8 > window.innerHeight &&
    bounds.top > menuBounds.height
  ) {
    popover.style.top = `${bounds.top - menuBounds.height - 6}px`;
  }
  trigger.setAttribute("aria-expanded", "true");
  if (popover.classList.contains("select-menu"))
    popover.querySelector('[aria-selected="true"]')?.focus();
}
function versionCard(v) {
  const cfg = ver[v],
    running = state[v + "Running"],
    normal = state.phase === "normal";
  const scope = normal
    ? "全部请求"
    : state.mode === "key"
      ? `${count(state.targets, v)} 个 Key`
      : `权重 ${state.weights[v]}`;
  const share = normal
    ? "100%"
    : state.phase === "observing"
      ? v === "old"
        ? "81.3%"
        : "18.7%"
      : state.phase === "finished"
        ? v === "new"
          ? "全部"
          : "无新请求"
        : v === "old"
          ? "已恢复"
          : "无新请求";
  return /* HTML */ `<section
    class="version compact-version ${state.selected === v ? "selected" : ""}"
    role="button"
    tabindex="0"
    data-action="select-version"
    data-version="${v}"
    aria-label="查看${cfg.name}配置"
    aria-pressed="${state.selected === v}"
  >
    <div class="version-head">
      <strong>${cfg.name}</strong
      ><span class="status"
        ><i class="dot ${running ? "" : "gray"}"></i
        >${running ? "运行中" : "已停止"}</span
      >
    </div>
    <p class="version-model">
      ${cfg.model}<span class="version-id">${cfg.id}</span>
    </p>
    <div class="compact-metrics">
      <span
        ><label
          >${normal ? "请求分配" : state.mode === "key" ? "API Key" : "配置权重"}</label
        ><b>${scope}</b></span
      ><span
        ><label>${state.phase === "observing" ? "流量占比" : "请求流向"}</label
        ><b>${share}</b></span
      ><span><label>运行实例</label><b>${running ? "2/2" : "0/2"}</b></span>
    </div>
  </section>`;
}
function overview() {
  const normal = state.phase === "normal";
  return /* HTML */ `<div class="service-overview">
    <aside class="versions-rail">
      <div class="versions-heading">
        <h3>部署版本</h3>
        <span class="muted small">${normal ? "1" : "2"} 个版本</span>
      </div>
      ${
        normal
          ? ""
          : /* HTML */ `<button class="release-entry" data-action="release">
              <span><i class="dot blue"></i>${phaseText()}</span
              ><span>发布详情${icon("right")}</span>
            </button>`
      }
      <div class="compact-version-list">
        ${versionCard("old")}${normal ? "" : versionCard("new")}
      </div>
    </aside>
    ${inferenceConfig()}
  </div>`;
}
function inferenceConfig() {
  const cfg = ver[state.selected],
    running = state[state.selected + "Running"];
  return /* HTML */ `<section class="panel config-panel service-config">
    <div class="panel-head">
      ${icon("down")}
      <h3>推理配置</h3>
      <span class="muted small spacer">${cfg.name} · ${cfg.id}</span>
    </div>
    <div class="config-body">
      <div class="config-section-title">
        <h3>资源信息</h3>
        <span class="muted small">当前版本的部署资源</span>
      </div>
      <div class="table-scroll">
        <table class="config-table">
          <thead>
            <tr>
              <th>推理引擎</th>
              <th>加速卡 / 实例</th>
              <th>CPU（核）</th>
              <th>内存（GiB）</th>
              <th>共享内存（GiB）</th>
              <th>节点数量</th>
              <th>参数配置</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>wings-vllm:0.21.0</td>
              <td>Ascend 910B × 8</td>
              <td>32</td>
              <td>128</td>
              <td>32</td>
              <td>2</td>
              <td><button class="link" data-action="params">详情</button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <h3>版本配置</h3>
      <div class="config-kv">
        <div>
          <label>模型版本</label>
          <p>${cfg.model}</p>
        </div>
        <div>
          <label>服务场景</label>
          <p>标准推理</p>
        </div>
        <div>
          <label>集群</label>
          <p>production-cluster</p>
        </div>
        <div>
          <label>运行实例数 / 总数</label>
          <p>${running ? "2 / 2" : "0 / 2"}</p>
        </div>
        <div>
          <label>最大上下文长度</label>
          <p>65,536 Tokens</p>
        </div>
        <div>
          <label>模型本地加速</label>
          <p>关闭</p>
        </div>
        <div>
          <label>创建者</label>
          <p>Administrator</p>
        </div>
        <div>
          <label>创建时间</label>
          <p>
            2026-10-${state.selected === "new" ? "21 11:32:00" : "12 09:18:00"}
          </p>
        </div>
      </div>
      <h3 class="schedule-heading">调度配置</h3>
      <div class="config-kv">
        <div>
          <label>调度器类型</label>
          <p>volcano</p>
        </div>
        <div>
          <label>推理调度</label>
          <p>xpu-engine-scheduler</p>
        </div>
      </div>
      <details class="advanced">
        <summary>
          ${icon("right")}高级配置<span class="spacer muted"
            >模型参数 / 部署参数</span
          >
        </summary>
        <p>
          张量并行度：8　 ·　 GPU 显存利用率：0.90<br />最大并发序列数：128　
          ·　 推理精度：BF16
        </p>
      </details>
      <div class="config-bottom">
        <span
          ><i class="dot ${running ? "" : "gray"}"></i
          >${running ? "部署正常，实例全部就绪" : "部署已停止"}</span
        ><button class="link" data-action="version-ops">
          版本操作${icon("down")}
        </button>
      </div>
    </div>
  </section>`;
}
function publishStrip() {
  const active = state.gateway === "active",
    finished = state.phase !== "observing";
  return /* HTML */ `<div class="release-health ${active ? "" : "pending"}">
    <span
      >${icon(active ? "checkCircle" : "clock")}${active ? "网关分流已生效 · 8/8" : "配置已保存 · 网关确认中 0/8"}</span
    ><span
      >${icon("clock")}${finished ? (active ? `${state.phase === "finished" ? "旧版" : "灰度版"}在途请求 ${state.drain} 个` : "等待切流后统计在途请求") : "在途流式请求由原版本继续处理"}</span
    ><span
      >${icon("resource")}${state.oldRunning && state.newRunning ? "两版部署资源保留" : "非生产版本资源已释放"}</span
    ><button class="link spacer" data-action="records">
      操作记录${icon("right")}
    </button>
  </div>`;
}
function navigate(view, tab) {
  state.view = view;
  if (tab) state.tab = tab;
  const hash = view === "release" ? "#gray-release" : "";
  if (location.hash !== hash)
    history.pushState(null, "", location.pathname + location.search + hash);
  render();
  window.scrollTo(0, 0);
}
function changeScene(scene) {
  clearTimeout(gatewayTimer);
  clearInterval(drainTimer);
  clearInterval(experienceTimer);
  closeModal();
  state = initialState();
  if (scene === "normal")
    Object.assign(state, {
      phase: "normal",
      selected: "old",
      newRunning: false,
      targets: [...baseline.targets],
      weights: { old: 100, new: 0 },
    });
  navigate("overview");
}
function openRelease(tab) {
  if (state.phase === "normal") {
    startRelease();
    return;
  }
  navigate("release", tab || "summary");
}
function startRelease() {
  openModal(
    "发起灰度发布",
    /* HTML */ `<p class="form-help">
        在同一服务下引入新版，指定试点应用先行使用。现有调用地址保持不变。
      </p>
      <div class="confirm-meta">
        <div>
          <label>当前正式版本</label><strong>${ver.old.model} / V001</strong>
        </div>
        <div>
          <label>灰度目标版本</label><strong>${ver.new.model} / V002</strong>
        </div>
      </div>
      <h3 style="margin-bottom:10px">预填试用方案</h3>
      <table class="distribution">
        <thead>
          <tr>
            <th>调用主体</th>
            <th>目标版本</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>研发一组 · AI Coding</td>
            <td>灰度版本</td>
          </tr>
          <tr>
            <td>平台团队 · Code Review</td>
            <td>灰度版本</td>
          </tr>
          <tr>
            <td>其他已接入应用</td>
            <td>保持正式版本</td>
          </tr>
        </tbody>
      </table>
      <p class="form-help" style="margin-top:14px">
        确认后进入灰度发布详情，可继续调整分流、对比版本效果或恢复原分流关系。
      </p>`,
    cancelButton +
      '<button class="primary" data-action="submit">确认并进入灰度发布</button>',
    () => {
      closeModal();
      state = initialState();
      navigate("release", "summary");
      showToast("已进入灰度发布场景（本地模拟）");
    },
  );
}
function render() {
  const drill = state.view === "release",
    normal = state.phase === "normal";
  document.querySelector(".basic").hidden = drill;
  document.querySelector(".page-tabs").hidden = drill;
  $("release-tag").hidden = true;
  $("demo-scene").value = normal ? "normal" : "gray";
  $("drill-breadcrumb").hidden = !drill;
  $("drill-breadcrumb").innerHTML = /* HTML */ `<span>推理服务</span
    ><span>/</span><span>在线服务</span><span>/</span
    ><button class="link" data-action="overview">AI-Coding</button><span>/</span
    ><strong aria-current="page">灰度发布</strong>`;
  document.querySelector(".heading").classList.toggle("drill-heading", drill);
  document.querySelector(".heading").innerHTML = drill
    ? /* HTML */ `<div class="drill-title">
          <div class="row">
            <h1>灰度发布</h1>
            <span class="tag ${state.gateway === "active" ? "" : "orange"}"
              >${phaseText()}</span
            >
          </div>
          <p>
            AI-Coding<span>·</span
            ><span class="mono">/v1/chat/completions</span>
          </p>
        </div>
        <div class="heading-actions">
          ${
            state.phase === "observing"
              ? /* HTML */ `<button
                    class="danger"
                    data-action="exit"
                    ${state.gateway === "active" ? "" : "disabled"}
                  >
                    退出灰度
                  </button>
                  <button
                    class="outline"
                    data-action="adjust"
                    ${state.gateway === "active" ? "" : "disabled"}
                  >
                    调整流量
                  </button>
                  <button
                    class="primary"
                    data-action="finish"
                    ${state.gateway === "active" ? "" : "disabled"}
                  >
                    完成发布
                  </button>`
              : /* HTML */ `<button
                  class="outline"
                  data-action="version-ops"
                  data-version="${state.phase === "finished" ? "old" : "new"}"
                >
                  版本操作
                </button>`
          }
        </div>`
    : /* HTML */ `${icon("arrowLeft")}
        <h1>部署详情</h1>
        <div class="heading-actions">
          <button
            class="square mobile-hide"
            data-action="refresh"
            aria-label="刷新"
          >
            ${icon("reload")}</button
          ><button class="extra" data-action="service-info">
            更多${icon("down")}</button
          ><button class="extra" data-action="service-info">编辑服务</button
          ><button class="extra" data-action="service-info">停止服务</button
          ><button class="mobile-hide" data-action="experience">体验</button
          ><button class="primary" data-action="release">
            ${normal ? "发起灰度发布" : "灰度发布"}${icon("right")}
          </button>
        </div>`;
  document.title =
    (drill ? "灰度发布" : "部署详情") + " · AI-Coding · FusionOne Center";
  $("main-view").innerHTML = drill ? comparison() : overview();
  enhanceSelects();
  requestAnimationFrame(drawChart);
}
function targetName(v) {
  return v === "none"
    ? "未分配"
    : v === "weighted"
      ? "按权重分流"
      : ver[v].name;
}
function keyRows(targets, editable = false, comparisonTargets = null) {
  return initialKeys
    .map(
      (k, i) =>
        /* HTML */ `<tr class="key-row" data-search="${esc(k[0] + " " + k[1])}">
          <td>${k[0]}<small class="mono">${k[1]}</small></td>
          ${editable || comparisonTargets ? /* HTML */ `<td>${comparisonTargets ? targetName(comparisonTargets[i]) : targetName(state.targets[i])}</td>` : ""}
          <td>
            ${
              editable
                ? /* HTML */ `<select
                    data-key-index="${i}"
                    aria-label="${k[0]}的目标版本"
                  >
                    <option
                      value="old"
                      ${targets[i] === "old" ? "selected" : ""}
                    >
                      正式版本
                    </option>
                    <option
                      value="new"
                      ${targets[i] === "new" ? "selected" : ""}
                    >
                      灰度版本
                    </option>
                    <option
                      value="none"
                      ${targets[i] === "none" ? "selected" : ""}
                    >
                      未分配
                    </option>
                  </select>`
                : /* HTML */ `<span
                    class="${targets[i] === "new" ? "tag purple" : targets[i] === "none" ? "none" : ""}"
                    >${targetName(targets[i])}</span
                  >`
            }
          </td>
          ${editable ? "" : /* HTML */ `<td>${targets[i] === comparisonTargets?.[i] ? '<span class="muted">保持原分配</span>' : targets[i] === "none" ? '<span class="orange-text">无目标版本</span>' : "有效"}</td>`}
        </tr>`,
    )
    .join("");
}
function adjustModal() {
  if (state.gateway !== "active") {
    showToast("网关正在确认上次变更，请等待生效后再调整");
    return;
  }
  if (state.phase !== "observing") {
    showToast("本次灰度已结束，可重置演示重新体验");
    return;
  }
  draft = {
    mode: state.mode,
    targets: [...state.targets],
    weights: { ...state.weights },
    fault: state.fault,
  };
  drawAdjust();
}
function drawAdjust() {
  const key = draft.mode === "key";
  openModal(
    "调整服务流量配置",
    /* HTML */ `<div class="form-label">分流策略</div>
      <div class="segmented">
        <button
          data-action="draft-mode"
          data-value="weight"
          class="${key ? "" : "active"}"
        >
          按相对权重</button
        ><button
          data-action="draft-mode"
          data-value="key"
          class="${key ? "active" : ""}"
        >
          按 API Key
        </button>
      </div>
      <p class="form-help">
        ${key ? "同一 API Key 的调用方将使用同一版本；提交前仅预览分流方案。" : "根据相对权重预览请求份额，提交前不会影响线上分流。"}
      </p>
      ${
        key
          ? /* HTML */ `<div class="table-scroll">
                <table class="distribution">
                  <thead>
                    <tr>
                      <th>API Key 名称 / 备注</th>
                      <th>当前分配</th>
                      <th>目标版本</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${keyRows(draft.targets, true)}
                  </tbody>
                </table>
              </div>
              <p class="impact-line" id="key-impact"></p>`
          : /* HTML */ `<table class="distribution weights">
                <thead>
                  <tr>
                    <th>版本名称</th>
                    <th>配置权重</th>
                    <th>预计流量比例</th>
                  </tr>
                </thead>
                <tbody>
                  ${["old", "new"]
                    .map(
                      (v) =>
                        /* HTML */ `<tr>
                          <td>
                            ${ver[v].name}<small
                              ><i class="dot"></i>运行中</small
                            >
                          </td>
                          <td>
                            <div class="number-input">
                              <button
                                data-action="weight-step"
                                data-version="${v}"
                                data-step="-5"
                                aria-label="减少${ver[v].name}权重"
                              >
                                −</button
                              ><input
                                id="weight-${v}"
                                type="number"
                                min="0"
                                max="1000"
                                step="1"
                                value="${draft.weights[v]}"
                                aria-label="${ver[v].name}权重"
                              /><button
                                data-action="weight-step"
                                data-version="${v}"
                                data-step="5"
                                aria-label="增加${ver[v].name}权重"
                              >
                                +
                              </button>
                            </div>
                          </td>
                          <td class="ratio-preview" id="ratio-${v}"></td>
                        </tr>`,
                    )
                    .join("")}
                </tbody>
              </table>
              <div class="preview-bar">
                <span id="old-bar"></span><span id="new-bar"></span>
              </div>
              <div class="preview-labels">
                <span>正式版本</span><span>灰度版本</span>
              </div>
              <p class="impact-line" id="weight-impact"></p>`
      }
      <section class="fault-section">
        <h3><span class="required">*</span>服务故障策略</h3>
        <div class="fault-options">
          <label
            ><input
              type="radio"
              name="fault"
              value="fallback"
              ${draft.fault === "fallback" ? "checked" : ""}
            />${key ? "目标异常时分流到其他正常版本" : "按比例分流到其他正常版本"}</label
          ><label
            ><input
              type="radio"
              name="fault"
              value="report"
              ${draft.fault === "report" ? "checked" : ""}
            />不分流，故障上报</label
          >
        </div>
        <p class="form-help" style="margin-bottom:0">
          ${key ? "故障分流可能使指定应用临时使用其他可用版本；未分配 Key 不会自动加入试用。" : "故障分流仅包含可用且权重大于 0 的版本。"}
        </p>
      </section>
      <div class="error-message" id="form-error" role="alert"></div>`,
    cancelButton +
      '<button class="primary" data-action="submit">预览变更</button>',
    previewAdjustment,
    false,
  );
  updateDraftPreview();
}
function updateDraftPreview() {
  if (!draft) return;
  if (draft.mode === "key") {
    const changed = draft.targets.filter(
        (t, i) => state.mode !== "key" || t !== state.targets[i],
      ).length,
      n = count(draft.targets, "none");
    $("key-impact").innerHTML = /* HTML */ `<b
        >${count(draft.targets, "new")} 个 Key → 灰度版本</b
      ><span
        >· ${count(draft.targets, "old")} 个 → 正式版本 · ${changed}
        个分配将变更</span
      >${n ? /* HTML */ `<span class="orange-text">· ${n} 个未分配，调用将无法路由</span>` : ""}`;
  } else {
    const r = ratios(draft.weights);
    for (const v of ["old", "new"]) {
      $("ratio-" + v).textContent = r
        ? `${r[v].toFixed(1).replace(".0", "")}%`
        : "—";
      $(v + "-bar").style.width = r ? `${r[v]}%` : "0%";
    }
    $("weight-impact").textContent = r
      ? `预计分流：正式 ${r.old.toFixed(1).replace(".0", "")}% / 灰度 ${r.new.toFixed(1).replace(".0", "")}%`
      : "请输入 0–1000 的整数，且两个版本权重之和大于 0。";
  }
}
function previewAdjustment() {
  if (draft.mode === "weight" && !ratios(draft.weights)) {
    $("form-error").textContent =
      "请输入 0–1000 的整数权重，且至少一个版本权重大于 0。";
    return;
  }
  showPlan("adjust", draft);
}
function showPlan(kind, target) {
  const isAdjust = kind === "adjust",
    finish = kind === "finish",
    restore = kind === "exit",
    key = target.mode === "key",
    before = sourceTargets(),
    valid = (v) => state[v + "Running"];
  if (
    (finish && !valid("new")) ||
    (restore &&
      (!valid("old") || (!valid("new") && target.targets.includes("new"))))
  ) {
    showToast("恢复目标不可用，请先启动目标版本后重试");
    return;
  }
  const changed = key
    ? target.targets.filter((v, i) => v !== before[i]).length
    : initialKeys.length;
  const title = isAdjust ? "确认分流变更" : finish ? "完成发布" : "退出灰度";
  openModal(
    title,
    /* HTML */ `<div class="notice ${restore ? "orange" : ""}">
        ${icon("info")}<span
          >${isAdjust ? "核对受影响的应用和目标版本，确认后提交分流配置。" : finish ? (key ? "将本服务现有 5 个有效 API Key 迁移至灰度版本；包含当前未分配的 1 个 Key。" : "将灰度版本权重设为 100、正式版本权重设为 0，全部后续请求进入灰度版本。") : "恢复进入本次灰度前保存的分流关系；原先未分配的 Key 保持未分配。"}</span
        >
      </div>
      <div class="confirm-meta">
        <div>
          <label>${restore ? "恢复快照" : "目标版本"}</label
          ><strong
            >${restore ? "2026-10-21 11:42 · 灰度开始前" : finish ? `${ver.new.model} / V002` : "按下方方案执行"}</strong
          >
        </div>
        <div>
          <label>影响范围</label
          ><strong
            >${key ? `${changed} 个 Key 的分配发生变化` : "所有调用此服务的请求"}</strong
          >
        </div>
      </div>
      ${
        key
          ? /* HTML */ `<div class="confirmation-table-wrap">
              <table class="distribution">
                <thead>
                  <tr>
                    <th>API Key / 调用主体</th>
                    <th>变更前</th>
                    <th>变更后</th>
                    <th>检查</th>
                  </tr>
                </thead>
                <tbody>
                  ${keyRows(target.targets, false, before)}
                </tbody>
              </table>
            </div>`
          : /* HTML */ `<table class="distribution weights">
              <thead>
                <tr>
                  <th>版本</th>
                  <th>当前权重</th>
                  <th>目标权重 / 预计比例</th>
                </tr>
              </thead>
              <tbody>
                ${["old", "new"]
                  .map(
                    (v) =>
                      /* HTML */ `<tr>
                        <td>${ver[v].name}</td>
                        <td>
                          ${state.mode === "weight" ? state.weights[v] : "当前按 API Key"}
                        </td>
                        <td>
                          ${target.weights[v]} /
                          ${ratios(target.weights)[v].toFixed(1).replace(".0", "")}%
                        </td>
                      </tr>`,
                  )
                  .join("")}
              </tbody>
            </table>`
      }
      <p class="confirm-description" style="margin-top:15px">
        ${
          state.mode !== target.mode
            ? /* HTML */ `
                分流策略将从
                <strong
                  >${state.mode === "key" ? "按 API Key" : "按相对权重"}</strong
                >
                切换为
                <strong>${key ? "按 API Key" : "按相对权重"}</strong>。<br />
              `
            : ""
        }
        配置保存后等待网关确认。<strong>在途流式请求继续由原版本处理</strong>，
        本次操作保留两版部署资源；需要释放资源时，再通过版本操作停止部署。
      </p>
      ${finish ? '<div class="notice orange" style="margin-bottom:0">' + icon("info") + "<span>请确认新版输出符合业务要求；双版本体验不代表已通过业务测试。</span></div>" : ""}`,
    /* HTML */ `<button data-action="${isAdjust ? "back-adjust" : "close"}">
        ${isAdjust ? "返回修改" : "取消"}</button
      ><button class="primary" data-action="submit">
        ${isAdjust ? "确认并应用" : finish ? "确认完成发布" : "确认退出灰度"}
      </button>`,
    () => applyPlan(kind, target),
    false,
  );
}
function applyPlan(kind, target) {
  if (state.gateway !== "active") return;
  state.mode = target.mode;
  state.targets = [...target.targets];
  state.weights = { ...target.weights };
  state.fault = target.fault;
  if (kind === "finish") state.phase = "finished";
  if (kind === "exit") state.phase = "exited";
  state.gateway = "pending";
  addRecord(
    kind === "finish"
      ? "完成发布：全部后续请求迁移至灰度版本"
      : kind === "exit"
        ? "退出灰度：恢复 11:42 保存的分流快照"
        : "调整流量：提交新的" +
          (target.mode === "key" ? " API Key 分配" : "相对权重"),
  );
  closeModal();
  render();
  showToast("分流配置已保存，等待网关确认（本地模拟）");
  clearTimeout(gatewayTimer);
  gatewayTimer = setTimeout(() => {
    state.gateway = "active";
    addRecord("网关 8/8 已确认分流配置");
    if (kind !== "adjust") {
      state.drain = 18;
      clearInterval(drainTimer);
      drainTimer = setInterval(() => {
        state.drain = Math.max(0, state.drain - 6);
        if (state.drain === 0) {
          clearInterval(drainTimer);
          addRecord("原版本在途请求已处理完成，部署资源仍保留");
        }
        render();
      }, 2400);
    }
    render();
    showToast("网关已生效，新请求按新方案分流（本地模拟）");
  }, 1800);
}
function scopeModal() {
  if (state.mode === "weight") {
    openModal(
      "当前分流配置",
      /* HTML */ `<p class="confirm-description">
          按相对权重分配请求，所有调用方均参与该分流方案。
        </p>
        <table class="distribution weights">
          <thead>
            <tr>
              <th>版本名称</th>
              <th>配置权重</th>
              <th>预计比例</th>
            </tr>
          </thead>
          <tbody>
            ${["old", "new"]
              .map(
                (v) =>
                  /* HTML */ `<tr>
                    <td>${ver[v].name}</td>
                    <td>${state.weights[v]}</td>
                    <td>
                      ${ratios(state.weights)[v].toFixed(1).replace(".0", "")}%
                    </td>
                  </tr>`,
              )
              .join("")}
          </tbody>
        </table>`,
      '<button class="primary" data-action="close">知道了</button>',
    );
    return;
  }
  openModal(
    "应用与 API Key 分配",
    /* HTML */ `<div class="notice">
        ${icon("key")}<span
          >共用同一 Key 的调用方将使用同一版本。以下按 Key 名称 /
          备注展示调用主体，完整密钥不在此显示。</span
        >
      </div>
      <div class="key-tools">
        <span class="spacer"
          >${count(state.targets, "new")} 个灰度 /
          ${count(state.targets, "old")} 个正式 /
          ${count(state.targets, "none")} 个未分配</span
        >
      </div>
      <div class="table-scroll">
        <table class="distribution">
          <thead>
            <tr>
              <th>API Key / 调用主体</th>
              <th>当前分配</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            ${keyRows(state.targets)}
          </tbody>
        </table>
      </div>`,
    /* HTML */ `<button data-action="close">关闭</button
      >${state.phase === "observing" ? '<button class="primary" data-action="adjust">调整分配</button>' : ""}`,
    null,
    false,
  );
}
function versionOps(v = state.selected) {
  const name = ver[v].name,
    retired =
      state.phase === "finished"
        ? "old"
        : state.phase === "exited"
          ? "new"
          : null,
    canStop =
      retired === v &&
      state.gateway === "active" &&
      state.drain === 0 &&
      state[v + "Running"];
  openModal(
    `${name}操作`,
    /* HTML */ `<div class="confirm-meta">
        <div>
          <label>部署版本</label><strong>${ver[v].model} / ${ver[v].id}</strong>
        </div>
        <div>
          <label>运行状态</label
          ><span
            ><i class="dot ${state[v + "Running"] ? "" : "gray"}"></i
            >${state[v + "Running"] ? "运行中 · 资源保留" : "已停止"}</span
          >
        </div>
      </div>
      <p class="confirm-description">
        ${canStop ? "该版本无后续请求，在途请求已结束。可保留部署作为人工回退窗口，也可停止部署释放资源。" : retired === v && state.drain > 0 ? `还有 ${state.drain} 个在途请求，处理结束后可停止部署。` : "当前版本仍在接收新请求，或本次灰度尚未结束。请完成流量迁移后再停止部署。"}
      </p>`,
    '<button data-action="close">关闭</button><button class="danger" data-action="submit" ' +
      (canStop ? "" : "disabled") +
      ">停止此版本</button>",
    () => {
      state[v + "Running"] = false;
      addRecord(`停止${name}部署，释放资源`);
      closeModal();
      render();
      showToast(`${name}已停止（本地模拟）`);
    },
  );
}
function showRecords() {
  openModal(
    "灰度发布操作记录",
    /* HTML */ `<ol class="timeline">
      ${state.records.map((r) => /* HTML */ `<li>${esc(r.message)}<time>2026-10-21 ${r.time} · Administrator · 本地模拟</time></li>`).join("")}
      <li>
        网关已生效，2 个 API Key 指向灰度版本<time>2026-10-21 11:42:05</time>
      </li>
      <li>
        保留灰度前分流快照，开始指定应用试用<time>2026-10-21 11:42:00</time>
      </li>
      <li>新版部署就绪，生产流量为 0<time>2026-10-21 11:32:00</time></li>
    </ol>`,
    '<button class="primary" data-action="close">关闭</button>',
  );
}
function customPeriod() {
  openModal(
    "自定义观察时间",
    /* HTML */ `<p class="form-help">
        选择同一时间范围观察新旧版本。演示数据范围：2026-10-21 11:00–14:00。
      </p>
      <div class="custom-range">
        <input
          type="datetime-local"
          id="range-start"
          aria-label="开始时间"
          min="2026-10-21T11:00"
          max="2026-10-21T13:59"
          value="2026-10-21T${state.customLabel?.split("–")[0] || "13:00"}"
        /><span>至</span
        ><input
          type="datetime-local"
          id="range-end"
          aria-label="结束时间"
          min="2026-10-21T11:01"
          max="2026-10-21T14:00"
          value="2026-10-21T${state.customLabel?.split("–")[1] || "14:00"}"
        />
      </div>
      <div class="error-message" id="range-error" role="alert"></div>`,
    cancelButton + '<button class="primary" data-action="submit">应用</button>',
    () => {
      const a = $("range-start").value,
        b = $("range-end").value;
      if (
        !a ||
        !b ||
        a >= b ||
        a < "2026-10-21T11:00" ||
        b > "2026-10-21T14:00"
      ) {
        $("range-error").textContent = "请在演示范围内选择有效的起止时间。";
        return;
      }
      const minutes = (s) =>
        Number(s.slice(11, 13)) * 60 + Number(s.slice(14, 16));
      state.period = "custom";
      state.customStart = minutes(a);
      state.customEnd = minutes(b);
      state.customLabel = `${a.slice(11)}–${b.slice(11)}`;
      const f = (state.customEnd - state.customStart) / 60;
      periods.custom = {
        ...periods.custom,
        start: a.slice(11),
        old: Math.round(186040 * f),
        new: Math.round(42860 * f),
      };
      closeModal();
      render();
    },
  );
}
const actions = {
  params: () =>
    openModal(
      "推理参数配置",
      /* HTML */ `<table class="distribution weights">
        <thead>
          <tr>
            <th>参数</th>
            <th>配置值</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>张量并行度</td>
            <td>8</td>
          </tr>
          <tr>
            <td>显存利用率</td>
            <td>0.90</td>
          </tr>
          <tr>
            <td>最大并发序列数</td>
            <td>128</td>
          </tr>
          <tr>
            <td>推理精度</td>
            <td>BF16</td>
          </tr>
        </tbody>
      </table>`,
      '<button class="primary" data-action="close">关闭</button>',
    ),
  refresh: () => showToast("示例数据已刷新 · 数据截至 2026-10-21 14:00:00"),
  "service-info": () =>
    openModal(
      "服务基本信息",
      '<p class="confirm-description">当前为灰度发布交互效果稿。服务级编辑与启停沿用 FOA 现有流程，本原型聚焦版本分流、效果对比和发布操作。</p>',
      '<button class="primary" data-action="close">知道了</button>',
    ),
  experience: () =>
    openModal(
      "服务体验",
      /* HTML */ `<p class="confirm-description">统一调用地址保持不变：</p>
        <pre
          class="mono small"
          style="padding:15px;background:#f7f9fd;overflow:auto"
        >
POST https://ai-coding.example/v1/chat/completions
Authorization: Bearer &lt;API_KEY&gt;</pre>
        <p class="form-help">
          使用试点团队的 API Key
          时，按照当前网关分配进入相应版本。此处不发送真实推理请求。
        </p>`,
      '<button class="primary" data-action="close">知道了</button>',
    ),
  close: closeModal,
  adjust: adjustModal,
  scope: scopeModal,
  "draft-mode": (el) => {
    draft.mode = el.dataset.value;
    drawAdjust();
  },
  "back-adjust": drawAdjust,
  "weight-step": (el) => {
    const v = el.dataset.version;
    draft.weights[v] = Math.max(
      0,
      Math.min(1000, (Number(draft.weights[v]) || 0) + Number(el.dataset.step)),
    );
    $("weight-" + v).value = draft.weights[v];
    updateDraftPreview();
  },
  submit: () => modalSubmit?.(),
  release: () => openRelease(),
  "run-experience": runExperience,
  "experience-preset": (el) => {
    const prompt = experiencePrompts[Number(el.dataset.prompt)];
    state.experience.prompt = prompt.text;
    $("experience-prompt").value = prompt.text;
    $("experience-error").textContent = "";
    $("experience-prompt").focus();
  },
  "period-menu": (el) => togglePopover(el, $("period-menu")),
  "period-option": (el) => {
    $("period-menu").hidePopover();
    if (el.dataset.value === "custom") customPeriod();
    else {
      state.period = el.dataset.value;
      state.customLabel = null;
      render();
      $("period")?.focus();
    }
  },
  "observation-help": (el) => togglePopover(el, $("observation-help")),
  "select-menu": (el) => togglePopover(el, $(el.getAttribute("aria-controls"))),
  "select-option": (el) => {
    const select = $(el.dataset.selectId);
    select.value = el.dataset.value;
    el.closest("[popover]").hidePopover();
    select.dispatchEvent(new Event("change", { bubbles: true }));
    enhanceSelects();
    select.nextElementSibling?.querySelector(".select-trigger")?.focus();
  },
  compare: (el) => {
    const tab = el.dataset.tab || "stability";
    openRelease(tab);
  },
  overview: () => navigate("overview"),
  "compare-tab": (el) => {
    state.tab = el.dataset.value;
    render();
  },
  "select-version": (el) => {
    state.selected = el.dataset.version;
    render();
  },
  finish: () => showPlan("finish", plan("finish")),
  exit: () => showPlan("exit", plan("exit")),
  "version-ops": (el) => versionOps(el.dataset.version || state.selected),
  records: showRecords,
  monitor: () =>
    openModal(
      "对应时段监控与日志",
      /* HTML */ `<p class="confirm-description">
          已保留对比上下文：${periods[state.period].label}，正式 V001 / 灰度
          V002。
        </p>
        <table class="distribution weights">
          <thead>
            <tr>
              <th>时间</th>
              <th>版本</th>
              <th>事件</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>13:32:18</td>
              <td>灰度 V002</td>
              <td>请求超时 · trace-••••9f12</td>
            </tr>
            <tr>
              <td>13:24:06</td>
              <td>正式 V001</td>
              <td>客户端取消 · trace-••••2a83</td>
            </tr>
          </tbody>
        </table>
        <p class="form-help">
          示例日志用于展示异常追踪入口，实际接入时沿用已有监控与日志能力。
        </p>`,
      '<button class="primary" data-action="close">关闭</button>',
    ),
  reset: () => {
    clearTimeout(gatewayTimer);
    clearInterval(drainTimer);
    closeModal();
    changeScene($("demo-scene").value);
    showToast("已重置当前演示场景");
  },
};
document.addEventListener("click", (event) => {
  const el = event.target.closest("[data-action]");
  if (el && !el.disabled) actions[el.dataset.action]?.(el);
});
document.addEventListener("keydown", (event) => {
  const menu = event.target.closest(".select-menu");
  if (menu && ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
    event.preventDefault();
    const options = Array.from(menu.querySelectorAll(".select-option"));
    const current = options.indexOf(document.activeElement);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? options.length - 1
          : (current + (event.key === "ArrowDown" ? 1 : -1) + options.length) %
            options.length;
    options[next]?.focus();
    return;
  }
  if (event.key === "ArrowDown" && event.target.matches(".select-trigger")) {
    event.preventDefault();
    event.target.click();
    return;
  }
  if (
    (event.key === "Enter" || event.key === " ") &&
    event.target.matches('[role="button"][data-action]')
  ) {
    event.preventDefault();
    event.target.click();
  }
});
document.addEventListener("input", (event) => {
  const el = event.target;
  if (el.id === "experience-prompt") {
    state.experience.prompt = el.value;
    $("experience-error").textContent = "";
  }
  if (el.id === "key-search") {
    const value = el.value.trim().toLowerCase();
    document
      .querySelectorAll(".key-row")
      .forEach(
        (row) =>
          (row.hidden = !row.dataset.search.toLowerCase().includes(value)),
      );
  }
  if (el.id.startsWith("weight-") && draft) {
    draft.weights[el.id.slice(7)] = el.value === "" ? NaN : Number(el.value);
    updateDraftPreview();
  }
});
document.addEventListener("change", (event) => {
  const el = event.target;
  if (el.id === "demo-scene") {
    changeScene(el.value);
    return;
  }
  if (el.dataset.keyIndex !== undefined && draft) {
    draft.targets[Number(el.dataset.keyIndex)] = el.value;
    updateDraftPreview();
  }
  if (el.name === "fault" && draft) draft.fault = el.value;
  if (el.id === "diff-only") {
    state.diff = el.checked;
    render();
  }
});
$("modal").addEventListener("click", (event) => {
  if (event.target === $("modal")) {
    const r = $("modal").getBoundingClientRect();
    if (
      event.clientX < r.left ||
      event.clientX > r.right ||
      event.clientY < r.top ||
      event.clientY > r.bottom
    )
      closeModal();
  }
});
$("modal").addEventListener("cancel", (event) => {
  event.preventDefault();
  closeModal();
});
window.addEventListener("resize", () => {
  document
    .querySelectorAll(":popover-open")
    .forEach((popover) => popover.hidePopover());
  requestAnimationFrame(drawChart);
});
// Runnable check: open this file with ?selftest=1; exercises weight validation and finish/exit plans without changing the demo.
function selfCheck() {
  const assert = (ok, message) => {
    if (!ok) throw Error("Self-check: " + message);
  };
  assert(ratios({ old: 80, new: 20 }).new === 20, "relative weights");
  assert(ratios({ old: 1, new: 3 }).old === 25, "normalize weights");
  for (const bad of [
    { old: 0, new: 0 },
    { old: -1, new: 2 },
    { old: NaN, new: 2 },
    { old: 1.5, new: 2 },
    { old: 1001, new: 1 },
  ])
    assert(ratios(bad) === null, "invalid weights rejected");
  const finish = plan("finish"),
    exit = plan("exit");
  assert(
    finish.targets.length === 5 && finish.targets.every((v) => v === "new"),
    "finish includes unassigned valid keys",
  );
  assert(
    exit.targets.every((v, i) => v === baseline.targets[i]),
    "restore original per-key assignment",
  );
  assert(exit.targets[4] === "none", "preserve original unassigned key");
  exit.targets[0] = "new";
  assert(baseline.targets[0] === "old", "snapshot immutable");
  assert(
    count(state.targets, "new") === 2 && count(state.targets, "old") === 2,
    "initial application scope",
  );
  assert(
    !overview().includes("release-observation") &&
      !overview().includes('data-action="finish"'),
    "overview stays clean",
  );
  const saved = state;
  state = { ...state, phase: "normal", selected: "old", newRunning: false };
  assert(
    !overview().includes("灰度版本") && !overview().includes("发布详情"),
    "normal service has no canary content",
  );
  state = saved;
  console.info("FOA gray release self-check: PASS");
  return true;
}
window.addEventListener("popstate", () => {
  state.view =
    location.hash === "#gray-release" && state.phase !== "normal"
      ? "release"
      : "overview";
  render();
});
state.view = location.hash === "#gray-release" ? "release" : "overview";
render();
if (new URLSearchParams(location.search).has("selftest")) {
  selfCheck();
  document.body.dataset.selftest = "passed";
  showToast("内置自检通过：普通服务、概览分层与分流方案");
}
