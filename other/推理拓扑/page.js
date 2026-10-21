/* exported highlightRelated */
"use strict";

const $ = (id) => document.getElementById(id);

// Theme belongs to the product shell, including dialogs rendered outside the canvas.
function readTheme() {
  try {
    return localStorage.getItem("foa-system-theme") !== "light";
  } catch {
    return true;
  }
}

function applyTheme() {
  document.documentElement.dataset.theme = state.dark ? "dark" : "light";
  const toggle = document.querySelector('[data-action="theme"]');
  toggle.innerHTML = icon(state.dark ? "Sun" : "Moon");
  toggle.setAttribute("aria-pressed", String(state.dark));
  toggle.title = state.dark ? "切换为浅色主题" : "切换为深色主题";
}

const tag = (text, type = "") => /* HTML */ `<span class="tag ${type}">${text}</span>`;
const initialState = () => ({
  cleared: false,
  saved: false,
  created: false,
  progress: 0,
  verified: false,
  isolated: [],
  records: [],
  selected: "i3",
  detailTab: "diagnosis",
  recordTab: "records",
  mode: "standard",
  filter: "all",
  period: "15",
  search: "",
  dark: readTheme(),
  zoom: 1,
  inspectorOpen: false,
  copySource: "实例-03",
});
let state = initialState(),
  buildTimer,
  toastTimer,
  previousFocus;
function transition(s, action) {
  const n = { ...s, isolated: [...s.isolated], records: [...s.records] };
  const record = (name, target, result, note) =>
    n.records.unshift({
      time: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
      name,
      target,
      result,
      note,
    });
  if (action === "cleanup" && !s.cleared) {
    n.cleared = true;
    n.saved = true;
    n.selected = "archive";
    record("清理异常实例", "实例-03", "已完成", "原配置已保留 · 其他健康实例继续运行");
  }
  if (action === "create" && !s.created) {
    n.created = true;
    n.progress = 0;
    n.selected = "i4";
    n.filter = "all";
    n.search = "";
    record("同配置新建", "实例-04", "执行中", "目标 node-04 · 配置来源：" + s.copySource);
  }
  if (action === "advance" && s.created && s.progress < 4) {
    n.progress++;
    if (n.progress === 4) {
      record("实际接流", "实例-04", "已完成", "已观测到实际请求和 Token 输出 · 业务待验证");
    }
  }
  if (action === "verify" && s.progress === 4 && !s.verified) {
    n.verified = true;
    record("业务验证", "AI-Coding", "已通过", "典型编码请求通过 · 对照服务指标确认恢复");
  }
  return n;
}
function instances() {
  const rows = [
    {
      id: "i1",
      name: "实例-01",
      host: "node-01",
      ip: "10.24.8.21",
      qps: state.verified ? "8.3" : "12.1",
      ttft: state.verified ? 620 : 640,
      load: state.verified ? 54 : 67,
      role: state.mode === "pd" ? "Prefill" : "",
      healthy: true,
    },
    {
      id: "i2",
      name: "实例-02",
      host: "node-02",
      ip: "10.24.8.22",
      qps: state.verified ? "8.0" : "12.7",
      ttft: state.verified ? 660 : 1420,
      load: state.verified ? 57 : 92,
      role: state.mode === "pd" ? "Decode" : "",
      healthy: true,
    },
  ];
  if (!state.cleared)
    rows.push({
      id: "i3",
      name: "实例-03",
      host: "node-03",
      ip: "10.24.8.23",
      qps: "0",
      ttft: null,
      load: 36,
      role: state.mode === "pd" ? "Decode" : "",
      healthy: false,
    });
  if (state.created)
    rows.push({
      id: "i4",
      name: "实例-04",
      host: "node-04",
      ip: "10.24.8.24",
      qps: state.progress === 4 ? (state.verified ? "8.5" : "2.1") : "0",
      ttft: state.progress === 4 ? 680 : null,
      load: state.progress === 4 ? 49 : 0,
      role: state.mode === "pd" ? "Decode" : "",
      healthy: state.progress >= 3,
      building: state.progress < 4,
    });
  return rows;
}
function renderSummary() {
  const recovered = state.verified && state.cleared;
  $("service-status").innerHTML = tag(
    recovered
      ? "运行正常"
      : state.progress === 4 && state.cleared
        ? "容量恢复 · 待核验"
        : "降级运行",
    recovered ? "" : state.progress === 4 && state.cleared ? "blue" : "warn",
  );
  const notice = $("notice");
  notice.className = "notice";
  if (recovered) {
    notice.classList.add("ok");
    notice.innerHTML = /* HTML */ `${icon("Check")}<span
        >服务已恢复 · 典型请求核验通过，原有实例持续运行</span
      ><button class="notice-action" data-action="show-recovery">查看结果 ›</button>`;
  } else if (state.progress === 4 && state.cleared) {
    notice.classList.add("neutral");
    notice.innerHTML = /* HTML */ `${icon("Check")}<span>实例-04 已接流 · 等待业务恢复核验</span
      ><button class="notice-action" data-action="show-recovery">核验恢复 ›</button>`;
  } else if (state.created) {
    notice.classList.add("neutral");
    notice.innerHTML = /* HTML */ `${icon("Clock")}<span
        >${state.progress < 4
          ? "实例-04 补建中 · " +
            ["资源准备", "模型加载", "等待运行就绪", "就绪，等待实际请求"][state.progress]
          : "实例-04 已接流 · 原异常实例仍待清理"}</span
      ><button class="notice-action" data-select="i4">查看实例 ›</button>`;
  } else if (state.cleared) {
    notice.classList.add("neutral");
    notice.innerHTML = /* HTML */ `${icon("Copy")}<span>异常实例已清理 · 配置快照已保留</span
      ><button class="notice-action" data-action="show-records">继续补建 ›</button>`;
  } else {
    notice.innerHTML = /* HTML */ `${icon("CircleAlert")}<span>1 个实例异常停止 · 剩余容量承压</span
      ><button class="notice-action" data-action="locate">定位异常 ›</button>`;
  }
}
function highlightRelated() {
  const id = state.selected;
  if (id.startsWith("g") && Number(id.split("-")[1]) >= 4) return;
  const related = /^[ng]/.test(id) ? "i" + id[1] : /^i/.test(id) ? id : null;
  if (!related) return;
  document.querySelector(`[data-select="${related}"]`)?.classList.add("selected");
  document.querySelector('[data-select="deployment"]')?.classList.add("selected");
  document.querySelector(`[data-related="${related}"]`)?.classList.add("related");
}
function renderRecords() {
  $("record-count").textContent = state.records.length;
  $("task-count").textContent = state.records.length;
  $("task-count").classList.toggle("pending", state.created && state.progress < 4);
  document.querySelectorAll('[data-action="record-tab"]').forEach((b) => {
    b.classList.toggle("active", b.dataset.value === state.recordTab);
    b.setAttribute("aria-selected", b.dataset.value === state.recordTab);
  });
  if (state.recordTab === "recovery") {
    $("records-body").innerHTML = /* HTML */ `<div class="recovery-copy">
        <strong>${state.verified ? "业务恢复核验通过" : "本次变更 · 恢复核验"}</strong>
        <p>运行就绪、实际接流、业务恢复分别确认。只有观测到实际请求后，才进行典型业务请求核验。</p>
      </div>
      <div class="recovery-checks">
        <span class="${state.progress >= 3 ? "done" : ""}"
          >${state.progress >= 3 ? "✓" : "○"} 运行就绪</span
        ><span class="${state.progress >= 4 ? "done" : ""}"
          >${state.progress >= 4 ? "✓" : "○"} 实际接流</span
        ><span class="${state.verified ? "done" : ""}">${state.verified ? "✓" : "○"} 业务恢复</span>
      </div>
      <div class="recovery-metrics">
        ${[
          ["首响应 P95 / ms", "1,280", "680"],
          ["请求成功率 / %", "98.6", "99.98"],
          ["输出吞吐 / tokens/s", "4,960", "7,520"],
        ]
          .map(
            (m) =>
              /* HTML */ `<div class="recovery-metric">
                <label>${m[0]}</label>
                <div>
                  <del>${m[1]}</del>${icon("ArrowRight")}<b>${state.verified ? m[2] : "—"}</b>
                </div>
              </div>`,
          )
          .join("")}
      </div>
      <div class="recovery-action">
        <button data-action="experience" ${state.progress < 4 ? "disabled" : ""}>
          ${icon("Play")}${state.verified ? "查看验证请求" : "发送典型编码请求"}
        </button>
        <p>
          ${state.progress < 4
            ? "等待新实例实际接流后继续"
            : "原有 2 个健康实例持续运行，配置未被改动"}
        </p>
      </div>
      <div class="recovery-note">
        对照范围：正式版本 · 固定 15
        分钟样本。指标为同一模型、资源规格及相近负载下的演示对照；单次请求与服务趋势共同用于核验。
      </div>
      ${state.verified
        ? /* HTML */ `<div class="drawer-mini-chart">
            <strong>首响应 P95 · 变更前后</strong
            ><svg viewBox="0 0 430 90">
              <path d="M0 23H430M0 54H430M0 80H430" stroke="var(--line)" stroke-dasharray="3 5" />
              <path
                d="M0 24 30 28 60 19 90 30 120 24 150 20 180 31 210 25 240 31 260 59 290 62 320 58 350 64 390 61 430 62"
                fill="none"
                stroke="var(--signal)"
                stroke-width="2"
              />
              <path d="M250 8v74" stroke="var(--muted)" stroke-dasharray="3 4" />
              <text x="260" y="14" fill="var(--muted)" font-size="9">实例-04 接流</text>
            </svg>
          </div>`
        : ""}`;
    return;
  }
  if (!state.records.length) {
    $("records-body").innerHTML = /* HTML */ `<div class="task-empty">
      ${icon("ClipboardList")}<strong>暂无变更任务</strong>
      <p>从节点右键菜单发起实例操作后，在这里跟踪执行进展、找回配置快照，并核验恢复结果。</p>
    </div>`;
    return;
  }
  $("records-body").innerHTML = state.records
    .map(
      (r) =>
        /* HTML */ `<article class="task-card">
          <div class="task-card-head">
            ${icon(
              r.name === "清理异常实例"
                ? "Trash2"
                : r.name === "业务验证"
                  ? "Check"
                  : r.name === "同配置新建"
                    ? "Copy"
                    : "Network",
            )}<strong>${r.name}</strong>${tag(r.result, r.result === "执行中" ? "blue" : "")}
          </div>
          <div class="task-meta">
            <span>对象：${r.target}</span><time class="mono">${r.time}</time>
          </div>
          <p>
            ${r.result === "执行中"
              ? [
                  "资源准备中",
                  "模型加载中",
                  "等待运行就绪",
                  "运行就绪，等待实际接流",
                  "已实际接流",
                ][state.progress] + "。 "
              : ""}${r.note}
          </p>
          ${r.name === "同配置新建" ? steps() : ""}
          <div class="task-card-footer">
            <span>${r.name === "清理异常实例" ? "原配置快照已保留" : "范围：" + r.target}</span
            >${r.name === "清理异常实例"
              ? /* HTML */ `<button
                  data-action="create"
                  data-source="实例-03"
                  ${state.created ? "disabled" : ""}
                >
                  ${icon("Copy")}同配置新建
                </button>`
              : r.name === "同配置新建"
                ? /* HTML */ `<button data-select="i4">查看实例</button>`
                : /* HTML */ `<button data-action="show-recovery">恢复核验</button>`}
          </div>
        </article>`,
    )
    .join("");
}
function render() {
  applyTheme();
  $("workspace").classList.toggle("inspector-hidden", !state.inspectorOpen);
  renderSummary();
  renderDiagram();
  renderInspector();
  renderRecords();
  if (state.inspectorOpen) revealSelection();
  document.querySelectorAll('[data-action="filter"]').forEach((button) => {
    button.classList.toggle("active", button.dataset.value === state.filter);
    button.setAttribute("aria-pressed", String(button.dataset.value === state.filter));
  });
  $("search").value = state.search;
}
function selectObject(id) {
  state.selected = id;
  state.detailTab = "diagnosis";
  state.inspectorOpen = true;
  $("workspace").classList.remove("inspector-hidden");
  renderDiagram();
  renderInspector();
  revealSelection();
}
function openDrawer(tabName = "records") {
  closeContextMenu(false);
  state.recordTab = tabName;
  renderRecords();
  if (!$("operation-drawer").open) $("operation-drawer").showModal();
}
function closeDrawer() {
  $("operation-drawer").close();
  document.querySelector(".task-trigger")?.focus();
}
function menuEntries(id, s = state) {
  const items = [
    { label: "查看日志与事件", icon: "FileText", action: "logs" },
    { label: "查看配置", icon: "Copy", action: "object-config" },
  ];
  if (/^i[1-4]$/.test(id) && !(id === "i3" && s.cleared)) {
    const building = id === "i4" && s.progress < 4,
      stopped = id === "i3";
    items.push(
      { label: "同角色对比", icon: "GitCompareArrows", action: "compare" },
      { divider: true },
      { label: "同配置新建", icon: "Copy", action: "create", disabled: s.created || building },
    );
    if (stopped)
      items.push(
        { divider: true },
        { label: "清理异常实例", icon: "Trash2", action: "cleanup", danger: true },
      );
    else
      items.push({
        label: s.isolated.includes(id) ? "恢复接流" : "流量隔离",
        icon: "Network",
        action: "isolate",
        disabled: building,
      });
    return items;
  }
  if (id.startsWith("g") && Number(id.split("-")[1]) >= 4)
    return [
      { label: "查看资源监控", icon: "ChartNoAxesCombined", action: "object-metrics" },
      { label: "查看资源配置", icon: "FileText", action: "object-config" },
      { divider: true },
      { label: "节点维护", icon: "Wrench", action: "node-maintenance" },
    ];
  if (/^[ng]/.test(id))
    return [
      { label: "定位关联实例", icon: "Network", action: "locate-related", value: "i" + id[1] },
      { label: "查看资源监控", icon: "ChartNoAxesCombined", action: "object-metrics" },
      { label: "查看资源配置", icon: "FileText", action: "object-config" },
      { divider: true },
      { label: "节点维护", icon: "Wrench", action: "node-maintenance" },
    ];
  if (id === "archive" || id === "i3")
    return [
      { label: "查看配置快照", icon: "FileText", action: "object-config" },
      { label: "同配置新建", icon: "Copy", action: "create", disabled: s.created },
      { divider: true },
      { label: "查看变更任务", icon: "ClipboardList", action: "show-records" },
    ];
  return [
    { label: "服务体验", icon: "Play", action: "experience" },
    { label: "查看监控", icon: "ChartNoAxesCombined", action: "object-metrics" },
    { label: "查看配置", icon: "FileText", action: "object-config" },
    { divider: true },
    { label: "新建实例", icon: "Plus", action: "create", disabled: s.created },
    { label: "SmartKVCache", icon: "Zap", action: "cache" },
    { label: "SmartDecoding", icon: "Zap", action: "decoding" },
    { divider: true },
    { label: "查看变更任务", icon: "ClipboardList", action: "show-records" },
  ];
}
let contextOrigin;
function menuPosition(x, y, w, h, vw, vh) {
  return { left: Math.max(8, Math.min(x, vw - w - 8)), top: Math.max(56, Math.min(y, vh - h - 8)) };
}
function openContextMenu(id, x, y) {
  contextOrigin = document.activeElement;
  selectObject(id);
  const menu = $("node-context");
  menu.className = "node-context";
  menu.innerHTML = /* HTML */ `${menuEntries(id)
    .map((e) =>
      e.divider
        ? /* HTML */ `<div class="context-divider" role="separator"></div>`
        : /* HTML */ `<button
            role="menuitem"
            class="${e.danger ? "danger" : ""}"
            data-action="${e.action}"
            ${e.value ? 'data-value="' + e.value + '"' : ""}
            ${e.disabled ? 'disabled aria-disabled="true"' : ""}
            tabindex="-1"
          >
            ${icon(e.icon)}${e.label}
          </button>`,
    )
    .join("")}`;
  menu.hidden = false;
  const rect = menu.getBoundingClientRect(),
    p = menuPosition(x, y, rect.width, rect.height, innerWidth, innerHeight);
  menu.style.left = p.left + "px";
  menu.style.top = p.top + "px";
  menu.querySelector('[role="menuitem"]:not(:disabled)')?.focus({ preventScroll: true });
}
function closeContextMenu(restore = true) {
  const menu = $("node-context");
  if (menu.hidden) return;
  menu.hidden = true;
  if (restore) {
    if (contextOrigin?.isConnected) contextOrigin.focus();
    else document.querySelector('[aria-label="所选对象更多操作"]')?.focus();
  }
}

function toast(message) {
  clearTimeout(toastTimer);
  $("toast").innerHTML = icon("Check") + message;
  $("toast").classList.add("show");
  toastTimer = setTimeout(() => $("toast").classList.remove("show"), 3400);
}
function showModal(title, body, footer) {
  previousFocus = document.activeElement;
  $("modal-title").textContent = title;
  $("modal-body").innerHTML = body;
  $("modal-footer").innerHTML =
    footer || /* HTML */ `<button data-action="close-modal">关闭</button>`;
  if (!$("modal").open) $("modal").showModal();
}
function closeModal() {
  $("modal").close();
  if (previousFocus?.isConnected) previousFocus.focus();
}
function openCleanup() {
  if (state.cleared) return;
  showModal(
    "清理异常实例",
    /* HTML */ `<p class="modal-summary">
        清理前自动保留完整实例配置。确认后仅移除所选异常实例，可从变更任务继续同配置新建。
      </p>
      <div class="scope-box">
        <dl class="config-list">
          <dt>实际执行对象</dt>
          <dd><b>实例-03</b> · 异常停止 · 无接流</dd>
          <dt>所属部署</dt>
          <dd>AI-Coding / 正式版本 v1.2.0</dd>
          <dt>保留内容</dt>
          <dd>模型、引擎、启动参数、资源规格</dd>
          <dt>影响范围</dt>
          <dd>仅实例-03；实例-01、实例-02 保持原配置并继续运行</dd>
          <dt>期望容量</dt>
          <dd>补建目标为 3 个，清理后暂时保持 2 个接流实例</dd>
        </dl>
      </div>
      <p class="preserved">${icon("Check")}配置快照随本次操作保存</p>
      <p class="quiet">此效果稿使用演示数据；确认仅改变本页演示状态。</p>`,
    /* HTML */ `<button data-action="close-modal">取消</button
      ><button class="danger" data-action="confirm-cleanup">确认清理实例-03</button>`,
  );
}
function openCreate() {
  if (state.created) {
    toast("本次补建已提交，可在变更任务中查看进展");
    return;
  }
  showModal(
    "同配置新建实例",
    /* HTML */ `<p class="modal-summary">
        复用 ${state.copySource} 的配置，将实例-04 加入同一部署，继续使用当前服务调用入口。
      </p>
      <div class="scope-box">
        ${configList(
          /* HTML */ `<dt>启动参数</dt><dd class="mono">TP=4 · max-model-len=32768<br>gpu-memory-utilization=0.90</dd><dt>配置来源</dt><dd>` +
            state.copySource +
            " · " +
            (state.saved && state.copySource === "实例-03" ? "清理前配置快照" : "当前配置") +
            /* HTML */ `</dd>`,
        )}
      </div>
      <h3>选择目标节点</h3>
      <p class="quiet">同时校验卡型、数量、健康、模型访问与部署约束。</p>
      <div class="candidates">
        <label class="candidate"
          ><input type="radio" name="target-node" value="node-04" checked />
          <div>
            <strong>node-04 <span class="muted">10.24.8.24</span></strong>
            <p>可用 4 × Ascend 910B · 64 GiB / 卡<br />模型可访问 · 部署约束匹配 · 健康正常</p>
          </div>
          ${tag("全部匹配")}</label
        ><label class="candidate disabled"
          ><input type="radio" name="target-node" value="node-05" disabled />
          <div>
            <strong>node-05</strong>
            <p>仅剩 2 张兼容卡，不满足 4 卡并行</p>
          </div>
          ${tag("容量不足", "gray")}</label
        ><label class="candidate disabled"
          ><input type="radio" name="target-node" value="node-06" disabled />
          <div>
            <strong>node-06</strong>
            <p>资源数据已过期，暂不具备提交条件</p>
          </div>
          ${tag("数据过期", "gray")}</label
        >
      </div>
      <p class="quiet" style="margin-top:13px">
        提交前再次校验目标资源。实例-01、实例-02 继续运行；本次不修改其配置。
      </p>`,
    /* HTML */ `<button data-action="close-modal">取消</button
      ><button class="primary" data-action="confirm-create">确认配置并新建</button>`,
  );
}
function startBuild() {
  const selected = document.querySelector('input[name="target-node"]:checked');
  if (selected?.value !== "node-04") {
    toast("请选择满足全部约束的可用节点");
    return;
  }
  closeModal();
  state = transition(state, "create");
  render();
  toast("已复用 " + state.copySource + " 的配置，正在补建实例-04");
  const tick = () => {
    state = transition(state, "advance");
    if (state.progress === 4) {
      const record = state.records.find((r) => r.name === "同配置新建");
      if (record) record.result = "已完成";
      toast("实例-04 已实际接流，可在变更任务中核验恢复");
    }
    render();
    if (state.progress < 4) buildTimer = setTimeout(tick, 1600);
  };
  clearTimeout(buildTimer);
  buildTimer = setTimeout(tick, 1600);
}
function openCompare() {
  const selected = instances().find((r) => r.id === state.selected),
    rows = instances().filter((r) => !selected?.role || r.role === selected.role);
  showModal(
    "同角色实例对比",
    /* HTML */ `<p class="modal-summary">
        同一模型、同一观察时段${selected?.role
          ? " · 角色 " + selected.role
          : ""}。运行状态与性能异常分开判断；无接流时不以零时延表示。
      </p>
      <table class="compare-table">
        <tr>
          <th>实例</th>
          <th>运行 / 接流</th>
          <th>请求 / s</th>
          <th>TTFT</th>
          <th>负载</th>
        </tr>
        ${rows
          .map(
            (r) =>
              /* HTML */ `<tr>
                <td>${r.name}</td>
                <td>
                  ${r.building
                    ? "准备中"
                    : r.healthy
                      ? "运行 / " + (state.isolated.includes(r.id) ? "隔离" : "接流")
                      : "停止 / 无接流"}
                </td>
                <td>${state.isolated.includes(r.id) ? "0" : r.qps}</td>
                <td>${r.ttft === null || r.building ? "—" : r.ttft + " ms"}</td>
                <td class="${r.load > 80 ? "warn" : ""}">
                  ${r.healthy && !r.building ? r.load + "%" : "—"}
                </td>
              </tr>`,
          )
          .join("")}
      </table>
      <p class="quiet" style="margin-top:15px">
        配置：vLLM 0.9.1 / TP=4 / 4 × Ascend 910B。资源健康正常不代表当前实例服务性能正常。
      </p>`,
  );
}
function openExperience() {
  const ready = state.progress === 4;
  showModal(
    ready ? "验证典型编码请求" : "服务体验",
    /* HTML */ `<p class="modal-summary">
        向当前服务入口发送典型 AI Coding 请求，结合首响应、输出连续性和服务指标验证恢复。
      </p>
      <div class="code-request">
        <span class="mono">POST /v1/chat/completions</span><br />请编写一个 Python
        函数，合并两个有序数组，并解释时间复杂度。
      </div>
      ${state.verified
        ? /* HTML */ `<div class="validation-result">
            ${icon("Check")}典型请求通过<br />HTTP 200 · 首响应 662 ms · 输出 256 Tokens<br />输出连续且完整，服务指标已在“变更任务
            / 恢复核验”中更新。
          </div>`
        : ready
          ? /* HTML */ `<div class="scope-box">
              <dl class="config-list">
                <dt>运行就绪</dt>
                <dd class="good">已通过</dd>
                <dt>实际接流</dt>
                <dd class="good">实例-04 已观测请求与 Token 输出</dd>
                <dt>业务恢复</dt>
                <dd>等待本次验证与同负载指标对照</dd>
              </dl>
            </div>`
          : /* HTML */ `<div class="object-alert warn">
              ${icon(
                "CircleAlert",
              )}当前服务降级运行。请先完成异常实例替换与实际接流，再进行恢复验证。
            </div>`}
      <p class="quiet" style="margin-top:12px">请求和结果均为本地演示，不会调用真实模型服务。</p>`,
    ready && !state.verified
      ? /* HTML */ `<button data-action="close-modal">取消</button
          ><button class="primary" data-action="confirm-verify">发送演示请求并验证</button>`
      : /* HTML */ `<button data-action="close-modal">关闭</button>`,
  );
}
function openAcceleration(kind) {
  const cache = kind === "cache";
  showModal(
    cache ? "SmartKVCache · Token 复用" : "SmartDecoding · 草稿接受",
    /* HTML */ `<p class="modal-summary">
        观察范围：AI-Coding / 正式版本 / 最近${state.period === "15" ? "15分钟" : "1小时"}。
      </p>
      <div class="accel-detail">
        <h3>${cache ? "所选时段 Token 复用率" : "所选时段草稿 Token 接受率"}</h3>
        <div class="accel-value">${cache ? "62" : "74"}%</div>
        <dl class="config-list">
          <dt>${cache ? "复用 Token" : "接受 Token"}</dt>
          <dd>${cache ? "1.86 M / 输入 3.00 M" : "0.74 M / 草稿 1.00 M"}</dd>
          <dt>累计统计</dt>
          <dd>${cache ? "18.6 M 复用 Token" : "7.4 M 接受 Token"} · 自本部署启动以来</dd>
          <dt>关联指标</dt>
          <dd>首响应时延、输出时延、吞吐</dd>
        </dl>
      </div>
      <div class="suggestion">
        ${icon("Lightbulb")}
        <div>
          <b>收益需在可比条件下评估</b
          >累计量与当前时段数据分开展示；草稿接受量不直接折算为费用或算力节省。
        </div>
      </div>`,
  );
}
function isolate() {
  const id = state.selected,
    r = instances().find((x) => x.id === id);
  if (!r?.healthy || r.building) return;
  const is = state.isolated.includes(id),
    remaining = 2 - state.isolated.length + (state.progress === 4 ? 1 : 0) + (is ? 1 : -1);
  showModal(
    is ? "恢复实例接流" : "隔离实例流量",
    /* HTML */ `<p class="modal-summary">
        ${is
          ? "检查就绪条件后恢复分发新请求。"
          : "先暂停分发新请求，等待在途请求完成，保留实例继续排查。"}
      </p>
      <div class="scope-box">
        <dl class="config-list">
          <dt>操作对象</dt>
          <dd>${r.name} / ${r.host}</dd>
          <dt>就绪检查</dt>
          <dd>已通过</dd>
          <dt>在途请求</dt>
          <dd>${is ? "0" : "8 → 等待完成后降至 0"}</dd>
          <dt>剩余接流实例</dt>
          <dd>${remaining} 个 / 目标 3 个</dd>
          <dt>操作范围</dt>
          <dd>仅 ${r.name}，其他实例保持运行</dd>
        </dl>
      </div>
      <p class="quiet">
        ${is
          ? "恢复后继续观察实际接流。"
          : "剩余容量减少，请结合业务负载评估后确认。"}此操作仅改变演示状态。
      </p>`,
    /* HTML */ `<button data-action="close-modal">取消</button
      ><button class="primary" data-action="confirm-isolate">
        ${is ? "确认恢复接流" : "等待排空后隔离"}
      </button>`,
  );
}
const actions = {
  "close-modal": closeModal,
  "close-drawer": closeDrawer,
  cleanup: openCleanup,
  create: (b) => {
    const current =
      instances().find((r) => r.id === state.selected) ||
      (/^[ng]/.test(state.selected)
        ? instances().find((r) => r.id === "i" + state.selected[1])
        : null);
    state.copySource =
      b?.dataset.source ||
      current?.name ||
      (state.selected === "archive" ? "实例-03" : "正式版本模板");
    openCreate();
  },
  compare: openCompare,
  experience: openExperience,
  "confirm-cleanup": () => {
    closeModal();
    state = transition(state, "cleanup");
    render();
    toast("实例-03 已清理，原配置已保留");
  },
  "confirm-create": startBuild,
  "confirm-verify": () => {
    state = transition(state, "verify");
    state.recordTab = "recovery";
    render();
    closeModal();
    openExperience();
  },
  "show-recovery": () => openDrawer("recovery"),
  "show-records": () => openDrawer("records"),
  locate: () => {
    state.selected = state.cleared ? "archive" : "i3";
    state.detailTab = "diagnosis";
    state.filter = "all";
    state.search = "";
    state.inspectorOpen = true;
    render();
  },
  "detail-tab": (b) => {
    state.detailTab = b.dataset.value;
    renderInspector();
  },
  "record-tab": (b) => {
    state.recordTab = b.dataset.value;
    renderRecords();
  },
  filter: (b) => {
    state.filter = b.dataset.value;
    state.search = "";
    render();
    if (state.filter === "error" && state.cleared) toast("当前运行拓扑中没有异常停止的实例");
  },
  "object-menu": (b) => {
    const p = b.getBoundingClientRect();
    openContextMenu(b.dataset.value || state.selected, p.left - 180, p.bottom + 6);
  },
  "object-config": () => {
    state.detailTab = "config";
    renderInspector();
  },
  "object-metrics": () => {
    state.detailTab = "metrics";
    renderInspector();
  },
  "locate-related": (b) => {
    if ($("operation-drawer").open) closeDrawer();
    selectObject(b.dataset.value);
  },
  "hide-inspector": () => {
    state.inspectorOpen = false;
    $("workspace").classList.add("inspector-hidden");
  },
  "show-inspector": () => {
    state.inspectorOpen = true;
    $("workspace").classList.remove("inspector-hidden");
    renderInspector();
  },
  fullscreen: (b) => {
    const full = $("workspace").classList.toggle("expanded");
    b.setAttribute("aria-label", full ? "退出拓扑全屏" : "展开拓扑全屏");
    fitBoard();
  },
  refresh: () => {
    $("freshness").innerHTML = /* HTML */ `<span class="dot good"></span>数据刚刚更新`;
    toast("已刷新当前对象与统一观察时段");
  },
  theme: () => {
    state.dark = !state.dark;
    applyTheme();
    try {
      localStorage.setItem("foa-system-theme", state.dark ? "dark" : "light");
    } catch {
      /* The theme remains usable when storage is unavailable. */
    }
  },
  "zoom-in": () => {
    state.zoom = Math.min(1.65, state.zoom + 0.15);
    fitBoard();
  },
  "zoom-out": () => {
    state.zoom = Math.max(0.55, state.zoom - 0.15);
    fitBoard();
  },
  fit: () => {
    state.zoom = 1;
    fitBoard();
  },
  reset: () => {
    clearTimeout(buildTimer);
    state = initialState();
    $("architecture").value = "standard";
    $("period").value = "15";
    render();
    toast("已重置为异常实例替换场景");
  },
  logs: () => {
    state.detailTab = "events";
    renderInspector();
  },
  cache: () => openAcceleration("cache"),
  decoding: () => openAcceleration("decoding"),
  isolate: isolate,
  "confirm-isolate": () => {
    const id = state.selected,
      is = state.isolated.includes(id);
    state.isolated = is ? state.isolated.filter((x) => x !== id) : [...state.isolated, id];
    state.verified = false;
    state.records.unshift({
      time: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
      name: is ? "恢复接流" : "流量隔离",
      target: instances().find((x) => x.id === id).name,
      result: "已完成",
      note: is ? "就绪检查通过，已恢复分发新请求" : "在途请求已排空，实例保留用于排查",
    });
    closeModal();
    render();
    toast(is ? "已恢复接流" : "新请求已暂停分发，在途请求已排空");
  },
  "node-maintenance": () => {
    const host = instances().find((r) => r.id === "i" + state.selected[1]);
    showModal(
      "节点维护 · 影响范围",
      /* HTML */ `<p class="modal-summary">
          先查看承载对象，补齐其他节点的容量并确认接流，再安排原节点退出。
        </p>
        <div class="scope-box">
          <dl class="config-list">
            <dt>维护节点</dt>
            <dd>${host.host}</dd>
            <dt>关联实例</dt>
            <dd>
              ${host.id === "i3" ? "原实例已停止，无当前设备绑定" : host.name + " / 正式版本"}
            </dd>
            <dt>资源范围</dt>
            <dd>8 × Ascend 910B（含其他负载）</dd>
            <dt>维护条件</dt>
            <dd>所有承载业务完成迁出并确认接流；当前页面仅覆盖 AI-Coding 关联实例</dd>
          </dl>
        </div>
        <p class="quiet">
          节点级维护需要进一步核对其他工作负载；本稿提供影响范围查看与实例定位。
        </p>`,
      /* HTML */ `<button data-action="close-modal">关闭</button
        ><button class="primary" data-action="maintenance-locate" data-value="${host.id}">
          定位关联实例
        </button>`,
    );
  },
  "maintenance-locate": (b) => {
    closeModal();
    state.selected = b.dataset.value;
    state.detailTab = "diagnosis";
    render();
  },
};
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-action]");
  if (b && !b.disabled) {
    if (b.dataset.action !== "object-menu") closeContextMenu(false);
    actions[b.dataset.action]?.(b);
    return;
  }
  const node = e.target.closest("[data-select]");
  if (node) {
    closeContextMenu(false);
    if ($("operation-drawer").open) closeDrawer();
    selectObject(node.dataset.select);
  }
});
document.addEventListener("contextmenu", (e) => {
  const node = e.target.closest("#board [data-object]");
  if (node) {
    e.preventDefault();
    openContextMenu(node.dataset.object, e.clientX, e.clientY);
  }
});
document.addEventListener("pointerdown", (e) => {
  if (!e.target.closest("#node-context") && !e.target.closest('[data-action="object-menu"]'))
    closeContextMenu(false);
});
document.addEventListener("keydown", (e) => {
  const menu = $("node-context");
  if (!menu.hidden) {
    const items = [...menu.querySelectorAll('[role="menuitem"]:not(:disabled)')],
      i = items.indexOf(document.activeElement);
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
      e.preventDefault();
      items[
        e.key === "Home"
          ? 0
          : e.key === "End"
            ? items.length - 1
            : (i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length
      ]?.focus({ preventScroll: true });
    } else if (e.key === "Escape" || e.key === "Tab") {
      e.preventDefault();
      closeContextMenu();
    }
    return;
  }
  if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) {
    const node = document.activeElement.closest?.("#board [data-object]");
    if (node) {
      e.preventDefault();
      const r = node.getBoundingClientRect();
      openContextMenu(node.dataset.object, r.left + r.width * 0.65, r.top + r.height * 0.5);
    }
  } else if (e.key === "Escape" && $("workspace").classList.contains("expanded")) {
    $("workspace").classList.remove("expanded");
    document.querySelector('[data-action="fullscreen"]').setAttribute("aria-label", "展开拓扑全屏");
    fitBoard();
  }
});
window.addEventListener("resize", () => closeContextMenu(false));
$("canvas").addEventListener("scroll", () => closeContextMenu(false));

$("architecture").addEventListener("change", (e) => {
  state.mode = e.target.value;
  render();
  if (state.mode === "pd") toast("已切换 P/D 角色示意；琥珀色虚线表示 KV 传输");
});
$("period").addEventListener("change", (e) => {
  state.period = e.target.value;
  render();
  toast("服务指标、对象诊断与加速统计已同步观察时段");
});
$("search").addEventListener("input", (e) => {
  state.search = e.target.value;
  renderDiagram();
});
$("modal").addEventListener("click", (e) => {
  if (e.target === $("modal")) {
    const r = $("modal").getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
      closeModal();
  }
});
new ResizeObserver(fitBoard).observe($("canvas"));
// 可运行检查：打开本文件后在控制台执行 runTopologyCheck()，或以 ?selftest=1 打开。
function runTopologyCheck() {
  const assert = (v, m) => {
    if (!v) throw new Error(m);
  };
  assert(
    !document.querySelector("i[data-lucide]") &&
      document.querySelector("#inspector svg.icon[aria-hidden]"),
    "本地图标必须完整渲染",
  );
  let s = initialState();
  s = transition(s, "cleanup");
  assert(s.cleared && s.saved, "清理必须同时保留原配置");
  assert(s.isolated.length === 0, "单实例清理不能隔离健康实例");
  assert(transition(s, "cleanup").records.length === 1, "清理不能重复执行");
  s = transition(s, "create");
  assert(s.created && s.progress === 0, "补建必须从资源准备开始");
  s = transition(s, "advance");
  s = transition(s, "advance");
  s = transition(s, "advance");
  assert(s.progress === 3 && !s.verified, "运行就绪不代表接流或业务恢复");
  assert(!transition(s, "verify").verified, "接流前不能通过恢复验证");
  s = transition(s, "advance");
  assert(!s.verified, "已接流仍需验证业务");
  s = transition(s, "verify");
  assert(s.verified, "接流后允许验证业务");
  assert(s.isolated.length === 0, "替换流程不得影响健康实例");
  assert(
    menuEntries("i3", initialState()).some((x) => x.action === "cleanup"),
    "停止实例应提供异常清理",
  );
  assert(
    !menuEntries("i1", initialState()).some((x) => x.action === "cleanup"),
    "健康实例不能出现异常清理",
  );
  assert(
    menuEntries("g2-1", initialState()).every((x) => x.action !== "cleanup"),
    "卡组不能出现实例清理",
  );
  assert(
    !menuEntries("g2-7", initialState()).some((x) => x.action === "locate-related"),
    "其他工作负载的设备不能关联本服务实例",
  );
  const p = menuPosition(1910, 1070, 220, 290, 1920, 1080);
  assert(p.left + 220 <= 1912 && p.top + 290 <= 1072, "右键菜单必须在视口内");
  console.info("PASS: 配置保留、阶段门槛、健康实例边界、右键操作状态与菜单边界");
  return true;
}
window.runTopologyCheck = runTopologyCheck;
render();
if (new URLSearchParams(location.search).has("selftest")) {
  runTopologyCheck();
  toast("交互状态检查通过");
}
